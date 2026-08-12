import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { buildAppCustomerDetailPath } from '@/constants/routes';
import {
  formatAgendaTime,
  getAgendaCoordinate,
  getAgendaStatusPresentation,
  getEventTitle,
} from '@/components/schedule/agendaModel';
import type { CustomerEvent } from '@/domain/customerEvent';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';

interface AgendaRowProps {
  event: CustomerEvent;
  customerName: string;
  now: Date;
  onOpen: (event: CustomerEvent) => void;
  isHighlighted?: boolean;
}

export function AgendaRow({
  event,
  customerName,
  now,
  onOpen,
  isHighlighted = false,
}: AgendaRowProps) {
  const { locale, t } = useTranslation();
  const presentation = getAgendaStatusPresentation(event, now);
  const coordinate = getAgendaCoordinate(event);
  const title = getEventTitle(event) ?? t('schedule.untitled');
  const statusLabel = t(`schedule.meta.${presentation.meta}`);
  const railClass = {
    planned: 'border-l-accent-primary-rail',
    warning: 'border-l-warning-rail',
    neutral: 'border-l-rail-neutral',
  }[presentation.rail];

  function activate() {
    onOpen(event);
  }

  return (
    <article
      data-agenda-row
      data-event-id={event.id}
      data-event-status={event.status}
      data-event-highlighted={isHighlighted ? 'true' : undefined}
      className={cn(
        'bg-surface border-border-subtle hover:bg-subtle/60 relative min-h-20 border-b border-l-[var(--status-rail-width)] px-4 py-3 text-left transition-colors',
        railClass,
        isHighlighted && 'event-highlight',
      )}
    >
      <button
        type="button"
        aria-label={t('schedule.openEvent', { title })}
        onClick={activate}
        className="focus-visible:outline-accent-primary absolute inset-0 z-0 block h-full w-full cursor-pointer rounded-none border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2"
      />

      <div className="pointer-events-none relative z-10 grid min-w-0 gap-1.5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center xl:gap-x-4">
        <div
          aria-hidden="true"
          className="flex min-w-0 items-start justify-between gap-3 xl:col-start-1 xl:row-start-1"
        >
          {event.status === 'OCCURRED' && event.descriptor ? (
            <Badge tone="neutral">{event.descriptor}</Badge>
          ) : (
            <h3
              className={cn(
                'min-w-0 flex-1 truncate text-sm font-semibold',
                event.status === 'CANCELLED' && 'text-text-secondary',
              )}
            >
              {title}
            </h3>
          )}
          {presentation.badge === 'overdue' && (
            <Badge tone="overdue">{t('schedule.overdueBadge')}</Badge>
          )}
          {presentation.badge === 'cancelled' && (
            <Badge tone="cancelled">{t('eventDetail.statusCancelled')}</Badge>
          )}
        </div>

        <Link
          to={buildAppCustomerDetailPath(event.customerId)}
          onClick={(clickEvent) => clickEvent.stopPropagation()}
          onKeyDown={(keyboardEvent) => keyboardEvent.stopPropagation()}
          className="text-accent-primary-deep pointer-events-auto inline-flex min-h-11 w-fit min-w-11 items-center text-sm font-semibold underline-offset-2 hover:underline xl:col-start-1 xl:row-start-2"
        >
          {customerName}
        </Link>

        <p
          aria-hidden="true"
          className="text-text-tertiary flex items-center gap-1 text-xs xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:justify-self-end xl:whitespace-nowrap"
        >
          <time dateTime={coordinate}>{formatAgendaTime(coordinate, locale)}</time>
          <span aria-hidden="true">·</span>
          <span>{statusLabel}</span>
        </p>

        {event.note && event.note !== title ? (
          <p className="text-text-secondary line-clamp-2 text-sm xl:col-start-1 xl:row-start-3">
            {event.note}
          </p>
        ) : null}
      </div>
    </article>
  );
}
