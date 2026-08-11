import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge';
import {
  formatAgendaTime,
  getAgendaCoordinate,
  getAgendaStatusPresentation,
  hasSameInstant,
} from '@/components/schedule/agendaModel';
import type { CustomerEvent } from '@/domain/customerEvent';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';

interface EventDetailProps {
  event: CustomerEvent;
  customerName: string;
  customerPath: string;
  now: Date;
}

export function EventDetail({ event, customerName, customerPath, now }: EventDetailProps) {
  const { locale, t } = useTranslation();
  const presentation = getAgendaStatusPresentation(event, now);
  const railClass = {
    planned: 'border-l-accent-primary-rail',
    warning: 'border-l-warning-rail',
    neutral: 'border-l-rail-neutral',
  }[presentation.rail];

  return (
    <article
      data-event-detail
      data-event-status={event.status}
      className={cn(
        'bg-surface border-border-default rounded-lg border border-l-[var(--status-rail-width)] p-5',
        railClass,
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {event.status === 'PLANNED' && !presentation.badge ? (
            <Badge tone="planned">{t('eventDetail.statusPlanned')}</Badge>
          ) : null}
          {presentation.badge === 'overdue' ? (
            <Badge tone="overdue">{t('schedule.overdueBadge')}</Badge>
          ) : null}
          {presentation.badge === 'cancelled' ? (
            <Badge tone="cancelled">{t('eventDetail.statusCancelled')}</Badge>
          ) : null}
          {event.status === 'OCCURRED' && event.descriptor ? (
            <Badge tone="neutral">{event.descriptor}</Badge>
          ) : null}
          {event.status === 'OCCURRED' ? (
            <span className="text-status-neutral-foreground text-xs font-semibold">
              {t('schedule.meta.occurred')}
            </span>
          ) : null}
        </div>

        <dl className="grid gap-3 text-sm">
          <div>
            <dt className="text-text-tertiary text-xs">{t('eventDetail.customer')}</dt>
            <dd className="mt-1">
              <Link
                to={customerPath}
                className="text-accent-primary-deep inline-flex min-h-11 items-center font-semibold underline-offset-2 hover:underline"
              >
                {customerName}
              </Link>
            </dd>
          </div>

          <TimeContext event={event} locale={locale} />
        </dl>

        {event.status === 'PLANNED' && presentation.badge === 'overdue' ? (
          <p className="text-warning text-sm font-semibold">{t('schedule.overdueMeta')}</p>
        ) : null}

        {event.note ? (
          <section className="border-border-subtle bg-subtle rounded-md border p-3">
            <h2 className="text-text-primary text-sm font-semibold">{t('eventDetail.memo')}</h2>
            <p className="text-text-secondary mt-1 text-sm">{event.note}</p>
          </section>
        ) : null}
      </div>
    </article>
  );
}

function TimeContext({ event, locale }: { event: CustomerEvent; locale: string }) {
  const { t } = useTranslation();

  if (event.status === 'OCCURRED') {
    if (!event.scheduledAt) {
      return (
        <TimeItem
          label={t('eventDetail.actualTime')}
          timestamp={event.occurredAt}
          locale={locale}
        />
      );
    }

    if (hasSameInstant(event.scheduledAt, event.occurredAt)) {
      return (
        <TimeItem label={t('eventDetail.time')} timestamp={event.occurredAt} locale={locale} />
      );
    }

    return (
      <>
        <TimeItem
          label={t('eventDetail.scheduledTime')}
          timestamp={event.scheduledAt}
          locale={locale}
        />
        <TimeItem
          label={t('eventDetail.actualTime')}
          timestamp={event.occurredAt}
          locale={locale}
        />
      </>
    );
  }

  return (
    <TimeItem
      label={t('eventDetail.scheduledTime')}
      timestamp={getAgendaCoordinate(event)}
      locale={locale}
    />
  );
}

function TimeItem({
  label,
  timestamp,
  locale,
}: {
  label: string;
  timestamp: string;
  locale: string;
}) {
  return (
    <div>
      <dt className="text-text-tertiary text-xs">{label}</dt>
      <dd className="text-text-primary mt-1 font-semibold">
        <time dateTime={timestamp}>{formatAgendaTime(timestamp, locale)}</time>
      </dd>
    </div>
  );
}
