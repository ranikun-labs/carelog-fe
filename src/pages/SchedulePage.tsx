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
import { OverdueCue } from '@/components/schedule/OverdueCue';
import { WeekStrip } from '@/components/schedule/WeekStrip';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  buildAppCustomerCreatePath,
  buildAppCustomersPath,
  buildAppEventCreatePath,
  buildAppEventDetailPath,
} from '@/constants/routes';
import type { CustomerEvent } from '@/domain/customerEvent';
import { SCHEDULE_FIXTURE, type ScheduleCustomer } from '@/fixtures/schedule';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import { useCustomerStore } from '@/state/CustomerStoreContext';
import { useOptionalEventStore } from '@/state/EventStoreContext';

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
  loadState = 'ready',
  onRetry,
}: SchedulePageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const adaptiveHost = useOptionalAdaptiveHost();
  const customerStore = useCustomerStore();
  const eventStore = useOptionalEventStore();
  const scheduleCustomers: readonly ScheduleCustomer[] =
    customers ?? customerStore.customers.map(({ id, displayName }) => ({ id, displayName }));
  const hasNoCustomers = scheduleCustomers.length === 0;
  const sourceEvents =
    eventStore && (events === undefined || events === SCHEDULE_FIXTURE.events)
      ? eventStore.events
      : (events ?? SCHEDULE_FIXTURE.events);
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
  const sectionSignature = sections.map((section) => section.dateKey).join('|');

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
    if (loadState !== 'ready' || sourceEvents.length === 0) return;
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

    element.scrollIntoView({
      behavior: targetEventId && didInitialAnchor.current ? 'smooth' : 'auto',
      block: targetEventId || !didInitialAnchor.current ? 'center' : 'start',
    });
    pendingAgendaTargetId.current = null;
    didInitialAnchor.current = true;
    shouldScrollToSelection.current = false;
  }, [loadState, selectedDateKey, sectionSignature, selectionRequest, sourceEvents.length]);

  useEffect(() => {
    if (loadState !== 'ready' || sourceEvents.length === 0) return;
    const scrollSurface = scrollSurfaceRef.current;
    if (!scrollSurface) return;

    const updateActiveDate = () => {
      if (didInitialAnchor.current && !didSkipInitialScroll.current) {
        didSkipInitialScroll.current = true;
        return;
      }

      const surfaceRect = scrollSurface.getBoundingClientRect();
      const weekStripBottom =
        scrollSurface.querySelector<HTMLElement>('[data-week-strip]')?.getBoundingClientRect()
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
  }, [loadState, sectionSignature, setSelectedDateKey, sourceEvents.length, todayDateKey]);

  useEffect(() => {
    if (loadState !== 'ready' || sourceEvents.length === 0) return;
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
  }, [loadState, sectionSignature, sourceEvents.length, todayDateKey]);

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
  }, [adaptiveHost, navigate, selectedDateKey]);

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
      className="bg-surface h-full min-h-full overflow-y-auto"
    >
      <AdaptiveSurfaceContent policy="scan">
        <header className="flex items-start justify-between gap-4 px-4 pt-6 pb-4">
          <div className="min-w-0">
            <p className="text-accent-primary text-xs font-semibold tracking-wide">
              {t('schedule.eyebrow')}
            </p>
            <h1 className="text-text-primary mt-1 text-2xl font-bold">{t('schedule.title')}</h1>
            <p className="text-text-secondary mt-1 text-sm">{t('schedule.description')}</p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="shrink-0"
            aria-label={t('schedule.addEvent')}
            data-schedule-add-event
            onClick={openEventCreate}
          >
            {t('schedule.addEvent')}
          </Button>
        </header>

        <WeekStrip
          days={weekDays}
          selectedDateKey={selectedDateKey}
          eventDateKeys={eventDateKeys}
          onSelect={selectDate}
        />

        {loadState === 'loading' ? (
          <AgendaSkeleton />
        ) : loadState === 'error' ? (
          <EmptyState
            title={t('schedule.errorTitle')}
            description={t('schedule.errorDescription')}
            action={
              <button
                type="button"
                className={cn(buttonVariants({ variant: 'text' }), 'mt-2')}
                onClick={onRetry}
              >
                {t('schedule.retry')}
              </button>
            }
          />
        ) : hasNoCustomers ? (
          <EmptyState
            title={t('schedule.emptyCustomersTitle')}
            description={t('schedule.emptyCustomersDescription')}
            action={
              <Link
                to={buildAppCustomerCreatePath()}
                className={cn(buttonVariants({ variant: 'secondary' }), 'mt-2')}
                aria-label={t('schedule.emptyCustomersFirstAction')}
                data-schedule-first-customer-cta
              >
                {t('schedule.emptyCustomersFirstAction')}
              </Link>
            }
          />
        ) : sourceEvents.length === 0 ? (
          <EmptyState
            title={t('schedule.emptyTitle')}
            description={t('schedule.emptyDescription')}
            action={
              <Link
                to={buildAppCustomersPath()}
                className={cn(buttonVariants({ variant: 'secondary' }), 'mt-2')}
                aria-label={t('schedule.emptyCustomersAction')}
              >
                {t('schedule.emptyCustomersAction')}
              </Link>
            }
          />
        ) : (
          <>
            <OverdueCue count={overdueEvents.length} onSelect={jumpToLatestOverdue} />

            {!todayVisible ? (
              <div className="px-4 pt-4">
                <button
                  type="button"
                  onClick={() => selectDate(todayDateKey)}
                  className="text-accent-primary-deep focus-visible:outline-accent-primary min-h-11 text-sm font-semibold underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {t('schedule.todayReturn')}
                </button>
              </div>
            ) : null}

            <div data-agenda className="mt-4 pb-6">
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
