import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { EmptyState } from '@/components/common/EmptyState';
import { AgendaSkeleton } from '@/components/schedule/AgendaSkeleton';
import { DateSection } from '@/components/schedule/DateSection';
import {
  buildAgendaSections,
  getAgendaDateKey,
  getDateKeyFromDate,
  getOverdueEvents,
  getWeekDays,
} from '@/components/schedule/agendaModel';
import { OverdueCue } from '@/components/schedule/OverdueCue';
import { WeekStrip } from '@/components/schedule/WeekStrip';
import { buttonVariants } from '@/components/ui/button';
import { buildAppCustomersPath, buildAppEventDetailPath } from '@/constants/routes';
import type { CustomerEvent } from '@/domain/customerEvent';
import { SCHEDULE_FIXTURE, type ScheduleCustomer } from '@/fixtures/schedule';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';

export type ScheduleLoadState = 'ready' | 'loading' | 'error';

export interface SchedulePageProps {
  events?: readonly CustomerEvent[];
  customers?: readonly ScheduleCustomer[];
  now?: Date;
  loadState?: ScheduleLoadState;
  onRetry?: () => void;
}

export function SchedulePage({
  events = SCHEDULE_FIXTURE.events,
  customers = SCHEDULE_FIXTURE.customers,
  now = new Date(),
  loadState = 'ready',
  onRetry,
}: SchedulePageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const todayDateKey = getDateKeyFromDate(now);
  const [selectedDateKey, setSelectedDateKey] = useState(todayDateKey);
  const [todayVisible, setTodayVisible] = useState(true);
  const didInitialAnchor = useRef(false);
  const shouldScrollToSelection = useRef(true);

  const weekDays = useMemo(() => getWeekDays(now), [now]);
  const eventDateKeys = useMemo(
    () => new Set(events.map((event) => getAgendaDateKey(event))),
    [events],
  );
  const overdueEvents = useMemo(() => getOverdueEvents(events, now), [events, now]);
  const sections = useMemo(
    () => buildAgendaSections(events, todayDateKey, selectedDateKey),
    [events, selectedDateKey, todayDateKey],
  );
  const sectionSignature = sections.map((section) => section.dateKey).join('|');

  useEffect(() => {
    if (loadState !== 'ready' || events.length === 0) return;
    if (!shouldScrollToSelection.current) return;
    const element = document.querySelector<HTMLElement>(
      `[data-agenda-section][data-date-key="${selectedDateKey}"]`,
    );
    if (!element || typeof element.scrollIntoView !== 'function') return;

    element.scrollIntoView({
      behavior: didInitialAnchor.current ? 'smooth' : 'auto',
      block: didInitialAnchor.current ? 'start' : 'center',
    });
    didInitialAnchor.current = true;
    shouldScrollToSelection.current = false;
  }, [events.length, loadState, selectedDateKey, sectionSignature]);

  useEffect(() => {
    if (loadState !== 'ready' || events.length === 0) return;
    const scrollSurface = document.querySelector<HTMLElement>('[data-scroll-surface]');
    if (!scrollSurface) return;

    const updateActiveDate = () => {
      const surfaceRect = scrollSurface.getBoundingClientRect();
      const sectionElements = Array.from(
        document.querySelectorAll<HTMLElement>('[data-agenda-section][data-date-key]'),
      );
      const nearest = sectionElements
        .map((element) => ({
          dateKey: element.dataset.dateKey ?? '',
          distance: Math.abs(element.getBoundingClientRect().top - surfaceRect.top),
        }))
        .filter(({ dateKey }) => dateKey.length > 0)
        .sort((first, second) => first.distance - second.distance)[0];

      if (!nearest) return;
      shouldScrollToSelection.current = false;
      setSelectedDateKey(nearest.dateKey);
      setTodayVisible(nearest.dateKey === todayDateKey);
    };

    scrollSurface.addEventListener('scroll', updateActiveDate, { passive: true });

    return () => scrollSurface.removeEventListener('scroll', updateActiveDate);
  }, [events.length, loadState, sectionSignature, todayDateKey]);

  useEffect(() => {
    if (loadState !== 'ready' || events.length === 0) return;
    const scrollSurface = document.querySelector<HTMLElement>('[data-scroll-surface]');
    const todayAnchor = document.querySelector<HTMLElement>('[data-today-anchor]');
    if (!scrollSurface || !todayAnchor || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) setTodayVisible(entry.isIntersecting);
      },
      { root: scrollSurface, threshold: 0.35 },
    );
    observer.observe(todayAnchor);
    return () => observer.disconnect();
  }, [events.length, loadState, sectionSignature, todayDateKey]);

  const selectDate = useCallback(
    (dateKey: string) => {
      shouldScrollToSelection.current = true;
      setSelectedDateKey(dateKey);
      setTodayVisible(dateKey === todayDateKey);
    },
    [todayDateKey],
  );

  const openEvent = useCallback(
    (event: CustomerEvent) => {
      navigate(buildAppEventDetailPath(event.id));
    },
    [navigate],
  );

  const jumpToLatestOverdue = useCallback(() => {
    const latestOverdue = overdueEvents[0];
    if (!latestOverdue) return;
    selectDate(getAgendaDateKey(latestOverdue));
  }, [overdueEvents, selectDate]);

  return (
    <main data-schedule-page className="bg-surface min-h-full">
      <header className="px-4 pt-6 pb-4">
        <p className="text-accent-primary text-xs font-semibold tracking-wide">
          {t('schedule.eyebrow')}
        </p>
        <h1 className="text-text-primary mt-1 text-2xl font-bold">{t('schedule.title')}</h1>
        <p className="text-text-secondary mt-1 text-sm">{t('schedule.description')}</p>
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
      ) : events.length === 0 ? (
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
                customers={customers}
                now={now}
                onOpen={openEvent}
              />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
