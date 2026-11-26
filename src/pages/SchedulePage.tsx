import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { EmptyState } from '@/components/common/EmptyState';
import {
  AdaptiveSurface,
  AdaptiveSurfaceContent,
  useOptionalAdaptiveHost,
} from '@/components/layout/adaptiveHostContext';
import { AgendaSkeleton } from '@/components/schedule/AgendaSkeleton';
import { DateSection } from '@/components/schedule/DateSection';
import {
  buildAgendaSections,
  getAgendaDateKey,
  getDateKeyFromDate,
  getOverdueEvents,
  getWeekDaysForDate,
} from '@/components/schedule/agendaModel';
import { EventSavedNotice } from '@/components/schedule/EventSavedNotice';
import { OverdueCue } from '@/components/schedule/OverdueCue';
import { WeekStrip } from '@/components/schedule/WeekStrip';
import { Button, buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import {
  buildAppCustomerCreatePath,
  buildAppCustomersPath,
  buildAppEventCreatePath,
  buildAppEventDetailPath,
} from '@/constants/routes';
import type { CustomerEvent } from '@/domain/customerEvent';
import { getCarelogMessageKey } from '@/integrations/carelog/errorMapping';
import { buildVisibleScheduleRange } from '@/integrations/carelog/timeRange';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import { useCustomerStore } from '@/state/CustomerStoreContext';
import { useOptionalEventCreateActivation } from '@/state/EventCreateActivationContext';
import { useOptionalEventStore } from '@/state/EventStoreContext';
import type { ScheduleCustomer } from '@/types/customer';

export type ScheduleLoadState = 'ready' | 'loading' | 'error';

export interface SchedulePageProps {
  events?: readonly CustomerEvent[];
  customers?: readonly ScheduleCustomer[];
  now?: Date;
  loadState?: ScheduleLoadState;
  onRetry?: () => void;
}

interface ScheduleNavigationState {
  targetEventId?: string;
  targetDateKey?: string;
  targetScrollTop?: number;
}

function readScheduleNavigationState(value: unknown): ScheduleNavigationState | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const state = value as Record<string, unknown>;
  return {
    ...(typeof state.targetEventId === 'string' ? { targetEventId: state.targetEventId } : {}),
    ...(typeof state.targetDateKey === 'string' ? { targetDateKey: state.targetDateKey } : {}),
    ...(typeof state.targetScrollTop === 'number' && Number.isFinite(state.targetScrollTop)
      ? { targetScrollTop: Math.max(0, state.targetScrollTop) }
      : {}),
  };
}

export function SchedulePage({
  events,
  customers,
  now = new Date(),
  loadState,
  onRetry,
}: SchedulePageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const adaptiveHost = useOptionalAdaptiveHost();
  const eventCreateActivation = useOptionalEventCreateActivation();
  const customerStore = useCustomerStore();
  const eventStore = useOptionalEventStore();
  const loadSchedule = eventStore?.loadSchedule;
  const remoteReadsEnabled = eventStore?.remoteReadsEnabled ?? false;
  const scheduleCustomers: readonly ScheduleCustomer[] =
    customers ?? customerStore.customers.map(({ id, displayName }) => ({ id, displayName }));
  const hasNoCustomers = scheduleCustomers.length === 0;
  const sourceEvents = events ?? eventStore?.events ?? [];
  const effectiveLoadState = loadState ?? eventStore?.scheduleLoadState ?? 'ready';
  const scheduleNavigation = readScheduleNavigationState(location.state);
  const todayDateKey = getDateKeyFromDate(now);
  const [localSelectedDateKey, setLocalSelectedDateKey] = useState(
    adaptiveHost?.schedule.selectedDateKey ?? scheduleNavigation?.targetDateKey ?? todayDateKey,
  );
  const selectedDateKey = adaptiveHost?.schedule.selectedDateKey ?? localSelectedDateKey;
  const initialScrollTop =
    scheduleNavigation?.targetScrollTop ?? adaptiveHost?.schedule.scrollTop ?? 0;
  const initialAgendaTargetId =
    scheduleNavigation?.targetEventId ?? adaptiveHost?.schedule.selectedEventId ?? null;
  const [todayVisible, setTodayVisible] = useState(() =>
    scheduleNavigation?.targetScrollTop === undefined ? true : selectedDateKey === todayDateKey,
  );
  const [selectionRequest, setSelectionRequest] = useState(0);
  const scrollSurfaceRef = useRef<HTMLElement>(null);
  const didInitialAnchor = useRef(false);
  const didSkipInitialScroll = useRef(false);
  const initialAnchor = useRef<{ top: number; height: number; at: number } | null>(null);
  const pendingAgendaTargetId = useRef<string | null>(initialAgendaTargetId);
  const shouldScrollToSelection = useRef(!(initialScrollTop > 0 && !initialAgendaTargetId));
  const explicitlySelectedDateKey = useRef<string | null>(null);
  const highlightedEventId = eventStore?.highlightedEventId ?? null;

  const setSelectedDateKey = useCallback(
    (dateKey: string) => {
      setLocalSelectedDateKey(dateKey);
      adaptiveHost?.setScheduleDate(dateKey);
    },
    [adaptiveHost],
  );

  const weekDays = useMemo(() => getWeekDaysForDate(selectedDateKey, now), [now, selectedDateKey]);
  const eventDateKeys = useMemo(
    () => new Set(sourceEvents.map((event) => getAgendaDateKey(event))),
    [sourceEvents],
  );
  const overdueEvents = useMemo(() => getOverdueEvents(sourceEvents, now), [now, sourceEvents]);
  const sections = useMemo(
    () => buildAgendaSections(sourceEvents, todayDateKey, selectedDateKey),
    [selectedDateKey, sourceEvents, todayDateKey],
  );
  const showOverdueCue =
    effectiveLoadState === 'ready' &&
    !hasNoCustomers &&
    sourceEvents.length > 0 &&
    overdueEvents.length > 0;
  const sectionSignature = sections.map((section) => section.dateKey).join('|');

  useEffect(() => {
    if (!remoteReadsEnabled || !loadSchedule || events !== undefined) return;
    void loadSchedule(buildVisibleScheduleRange(selectedDateKey)).catch(() => undefined);
  }, [events, loadSchedule, remoteReadsEnabled, selectedDateKey]);

  const retrySchedule =
    onRetry ??
    (() => {
      if (!remoteReadsEnabled || !loadSchedule) return;
      void loadSchedule(buildVisibleScheduleRange(selectedDateKey)).catch(() => undefined);
    });

  useEffect(() => {
    const scrollSurface = scrollSurfaceRef.current;
    if (!scrollSurface) return;

    if (!pendingAgendaTargetId.current && initialScrollTop > 0) {
      scrollSurface.scrollTop = initialScrollTop;
    }

    const updateScrollPosition = () => {
      adaptiveHost?.setScheduleScrollTop(scrollSurface.scrollTop);
    };
    scrollSurface.addEventListener('scroll', updateScrollPosition, { passive: true });
    return () => scrollSurface.removeEventListener('scroll', updateScrollPosition);
  }, [adaptiveHost, initialScrollTop]);

  useEffect(() => {
    if (effectiveLoadState !== 'ready' || sourceEvents.length === 0) return;
    if (!shouldScrollToSelection.current) return;
    const scrollSurface = scrollSurfaceRef.current;
    if (!scrollSurface) return;
    const targetEventId = pendingAgendaTargetId.current;
    const element = targetEventId
      ? Array.from(
          scrollSurface.querySelectorAll<HTMLElement>('[data-agenda-row][data-event-id]'),
        ).find((candidate) => candidate.dataset.eventId === targetEventId)
      : scrollSurface.querySelector<HTMLElement>(
          `[data-agenda-section][data-date-key="${selectedDateKey}"]`,
        );
    if (!element || typeof element.scrollIntoView !== 'function') return;

    const isInitialAnchor = !didInitialAnchor.current;
    element.scrollIntoView({
      behavior: targetEventId && didInitialAnchor.current ? 'smooth' : 'auto',
      block: targetEventId || !didInitialAnchor.current ? 'center' : 'start',
    });
    if (isInitialAnchor) {
      initialAnchor.current = {
        top: scrollSurface.scrollTop,
        height: scrollSurface.scrollHeight,
        at: performance.now(),
      };
    }
    pendingAgendaTargetId.current = null;
    didInitialAnchor.current = true;
    shouldScrollToSelection.current = false;
  }, [
    effectiveLoadState,
    selectedDateKey,
    sectionSignature,
    selectionRequest,
    sourceEvents.length,
  ]);

  useEffect(() => {
    if (effectiveLoadState !== 'ready' || sourceEvents.length === 0) return;
    const scrollSurface = scrollSurfaceRef.current;
    if (!scrollSurface) return;

    const updateActiveDate = () => {
      if (didInitialAnchor.current && !didSkipInitialScroll.current) {
        didSkipInitialScroll.current = true;
        return;
      }

      // 첫 앵커 직후 글꼴·레이아웃이 자리 잡으며 스크롤 높이가 바뀌면 브라우저가 scroll 이벤트를 더 낸다.
      // 사용자가 움직인 게 아니므로 무시한다 — 안 그러면 가운데 정렬된 오늘이 위 날짜로 밀리거나
      // 맨 아래 보정으로 마지막 날짜가 선택돼 오늘이 풀린다. 이동량이 4px 이내이거나 높이 변화량으로
      // 설명되면 정착 이벤트로 보고 기준 위치를 새로 잡는다(높이 변화보다 크게 움직인 사용자 스크롤은 통과).
      const anchor = initialAnchor.current;
      if (anchor && performance.now() - anchor.at < 1000) {
        const settleTolerance = Math.max(4, Math.abs(scrollSurface.scrollHeight - anchor.height));
        if (Math.abs(scrollSurface.scrollTop - anchor.top) <= settleTolerance) {
          initialAnchor.current = {
            ...anchor,
            top: scrollSurface.scrollTop,
            height: scrollSurface.scrollHeight,
          };
          return;
        }
      }

      const surfaceRect = scrollSurface.getBoundingClientRect();
      const weekStripBottom =
        scrollSurface.querySelector<HTMLElement>('[data-schedule-sticky]')?.getBoundingClientRect()
          .bottom ?? surfaceRect.top;
      const sectionElements = Array.from(
        scrollSurface.querySelectorAll<HTMLElement>('[data-agenda-section][data-date-key]'),
      );
      const sectionRects = sectionElements
        .map((element) => ({
          dateKey: element.dataset.dateKey ?? '',
          top: element.getBoundingClientRect().top,
        }))
        .filter(({ dateKey }) => dateKey.length > 0);

      const isAtBottom =
        scrollSurface.scrollHeight > scrollSurface.clientHeight &&
        scrollSurface.scrollTop + scrollSurface.clientHeight >= scrollSurface.scrollHeight - 1;
      const nearest = isAtBottom
        ? sectionRects.at(-1)
        : (sectionRects.find(({ top }) => top >= Math.max(surfaceRect.top, weekStripBottom)) ??
          sectionRects.at(-1));

      if (!nearest) return;
      shouldScrollToSelection.current = false;
      setSelectedDateKey(nearest.dateKey);
      setTodayVisible(nearest.dateKey === todayDateKey);
    };

    scrollSurface.addEventListener('scroll', updateActiveDate, { passive: true });

    return () => scrollSurface.removeEventListener('scroll', updateActiveDate);
  }, [effectiveLoadState, sectionSignature, setSelectedDateKey, sourceEvents.length, todayDateKey]);

  useEffect(() => {
    if (effectiveLoadState !== 'ready' || sourceEvents.length === 0) return;
    const scrollSurface = scrollSurfaceRef.current;
    const todayAnchor = scrollSurface?.querySelector<HTMLElement>('[data-today-anchor]');
    if (!scrollSurface || !todayAnchor || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setTodayVisible(entry.isIntersecting);
      },
      { root: scrollSurface, threshold: 0.35 },
    );
    observer.observe(todayAnchor);
    return () => observer.disconnect();
  }, [effectiveLoadState, sectionSignature, sourceEvents.length, todayDateKey]);

  useEffect(() => {
    if (!eventStore || !highlightedEventId) return;
    const timeoutId = window.setTimeout(() => {
      eventStore.clearHighlight(highlightedEventId);
    }, 1600);
    return () => window.clearTimeout(timeoutId);
  }, [eventStore, highlightedEventId]);

  const selectDate = useCallback(
    (dateKey: string, targetEventId?: string) => {
      explicitlySelectedDateKey.current = dateKey;
      pendingAgendaTargetId.current = targetEventId ?? null;
      shouldScrollToSelection.current = true;
      setSelectionRequest((request) => request + 1);
      setSelectedDateKey(dateKey);
      setTodayVisible(dateKey === todayDateKey);
    },
    [setSelectedDateKey, todayDateKey],
  );

  const openEvent = useCallback(
    (event: CustomerEvent) => {
      const targetDateKey = getAgendaDateKey(event);
      if (adaptiveHost) {
        adaptiveHost.selectEvent(event.id, { root: 'schedule', targetDateKey });
        return;
      }
      navigate(buildAppEventDetailPath(event.id));
    },
    [adaptiveHost, navigate],
  );

  const openEventCreate = useCallback(() => {
    eventCreateActivation?.beginCreateSession();
    const renderedSelectedDateKey = scrollSurfaceRef.current?.querySelector<HTMLElement>(
      '[data-week-strip] button[aria-current="date"]',
    )?.dataset.dateKey;
    const entryDateKey =
      explicitlySelectedDateKey.current ?? renderedSelectedDateKey ?? selectedDateKey;
    const entryScrollTop =
      scrollSurfaceRef.current?.scrollTop ?? adaptiveHost?.schedule.scrollTop ?? 0;
    if (adaptiveHost) {
      adaptiveHost.setScheduleDate(entryDateKey);
      adaptiveHost.setScheduleScrollTop(entryScrollTop);
    }

    navigate(buildAppEventCreatePath(), {
      state: {
        adaptiveRoot: 'schedule',
        targetDateKey: entryDateKey,
        targetScrollTop: entryScrollTop,
      },
    });
  }, [adaptiveHost, eventCreateActivation, navigate, selectedDateKey]);

  const jumpToLatestOverdue = useCallback(() => {
    const latestOverdue = overdueEvents[0];
    if (!latestOverdue) return;
    selectDate(getAgendaDateKey(latestOverdue), latestOverdue.id);
  }, [overdueEvents, selectDate]);

  return (
    <AdaptiveSurface
      ref={scrollSurfaceRef}
      majorSurface="schedule"
      data-schedule-page
      data-scroll-surface
      data-root-scroll-surface="schedule"
      className="h-full min-h-full overflow-y-auto"
    >
      {/* scan 폭 720: 1024~1179 가로·1280 세로에서 행이 944px 이상으로 늘어나 한눈에 읽기 어려운 문제를 막는다. */}
      <AdaptiveSurfaceContent policy="scan" className="max-w-[45rem] xl:max-w-[45rem]">
        <header className="flex items-start justify-between gap-4 px-4 pt-8 pb-3 md:px-6 md:pt-10">
          <div className="min-w-0">
            <h1 className="type-page-title text-foreground break-keep">{t('schedule.title')}</h1>
            <p className="type-supporting text-text-secondary mt-1 break-keep">
              {t('schedule.description')}
            </p>
          </div>
        </header>

        {/* 고정 영역: "+ 일정"·정리 필요 안내·주간 띠. 오늘로 자동 스크롤돼 열려도 항상 화면 안에 있다(F3 C-03). */}
        <div data-schedule-sticky className="bg-surface sticky top-0 z-20">
          <div className="flex items-center gap-2 px-4 pt-2 md:px-6">
            {showOverdueCue ? (
              <OverdueCue count={overdueEvents.length} onSelect={jumpToLatestOverdue} />
            ) : (
              <div className="min-w-0 flex-1" />
            )}
            {/* 훑어보러 오는 화면이라 "+ 일정"은 Subtle(Strong 0). 고객 0명 빈 상태 CTA만 Strong 1. */}
            <Button
              type="button"
              variant="subtle"
              size="sm"
              className="shrink-0"
              aria-label={t('schedule.addEvent')}
              data-schedule-add-event
              onClick={openEventCreate}
            >
              {t('schedule.addEvent')}
            </Button>
          </div>
          <WeekStrip
            days={weekDays}
            selectedDateKey={selectedDateKey}
            eventDateKeys={eventDateKeys}
            onSelect={selectDate}
          />
          {/* 저장 알림도 고정 영역에 둔다. 새 일정으로 스크롤돼도 문장이 화면 안에 남는다. */}
          <EventSavedNotice className="mx-4 mt-1 md:mx-6" />
        </div>

        {effectiveLoadState === 'loading' ? (
          <AgendaSkeleton />
        ) : effectiveLoadState === 'error' ? (
          <ErrorState
            className="mx-4 mt-4 md:mx-6"
            title={t('schedule.errorTitle')}
            description={
              eventStore?.error
                ? t(getCarelogMessageKey(eventStore.error))
                : t('schedule.errorDescription')
            }
            action={
              <button
                type="button"
                className={buttonVariants({ variant: 'subtle' })}
                onClick={retrySchedule}
              >
                {t('schedule.retry')}
              </button>
            }
          />
        ) : hasNoCustomers ? (
          <div className="bg-inset rounded-card mx-4 mt-4 md:mx-6">
            <EmptyState
              title={t('schedule.emptyCustomersTitle')}
              description={t('schedule.emptyCustomersDescription')}
              action={
                <Link
                  to={buildAppCustomerCreatePath()}
                  className={cn(buttonVariants({ variant: 'strong' }), 'mt-2')}
                  aria-label={t('schedule.emptyCustomersFirstAction')}
                  data-schedule-first-customer-cta
                >
                  {t('schedule.emptyCustomersFirstAction')}
                </Link>
              }
            />
          </div>
        ) : sourceEvents.length === 0 ? (
          <div className="bg-inset rounded-card mx-4 mt-4 md:mx-6">
            <EmptyState
              title={t('schedule.emptyTitle')}
              description={t('schedule.emptyDescription')}
              action={
                <Link
                  to={buildAppCustomersPath()}
                  className={cn(buttonVariants({ variant: 'subtle' }), 'mt-2')}
                  aria-label={t('schedule.emptyCustomersAction')}
                >
                  {t('schedule.emptyCustomersAction')}
                </Link>
              }
            />
          </div>
        ) : (
          <>
            {!todayVisible ? (
              <div className="px-4 pt-2 md:px-6">
                <button
                  type="button"
                  onClick={() => selectDate(todayDateKey)}
                  className={buttonVariants({ variant: 'text', size: 'sm' })}
                >
                  {t('schedule.todayReturn')}
                </button>
              </div>
            ) : null}

            <div data-agenda className="mt-4 flex flex-col gap-6 px-4 pb-8 md:px-6">
              {sections.map((section) => (
                <DateSection
                  key={section.dateKey}
                  section={section}
                  customers={scheduleCustomers}
                  now={now}
                  onOpen={openEvent}
                  highlightedEventId={highlightedEventId}
                />
              ))}
            </div>
          </>
        )}
      </AdaptiveSurfaceContent>
    </AdaptiveSurface>
  );
}
