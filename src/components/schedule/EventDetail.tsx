import { useState } from 'react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getCarelogMessageKey } from '@/integrations/carelog/errorMapping';
import {
  EventForm,
  toCanonicalTimestamp,
  toDateTimeLocalValue,
  type EventFormSubmitValues,
} from '@/components/schedule/EventForm';
import {
  formatAgendaDateTime,
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
  onOpenCustomer?: () => void;
  onEdit?: (
    values: EventFormSubmitValues,
  ) => CustomerEvent | undefined | Promise<CustomerEvent | undefined>;
  onCancelEvent?: () => CustomerEvent | undefined | Promise<CustomerEvent | undefined>;
  onOccurEvent?: (
    occurredAt: string,
  ) => CustomerEvent | undefined | Promise<CustomerEvent | undefined>;
}

export function EventDetail({
  event,
  customerName,
  customerPath,
  now,
  onOpenCustomer,
  onEdit,
  onCancelEvent,
  onOccurEvent,
}: EventDetailProps) {
  const { locale, t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingOccurrence, setIsConfirmingOccurrence] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [occurrenceTime, setOccurrenceTime] = useState(
    event.status === 'PLANNED' ? toDateTimeLocalValue(event.scheduledAt) : '',
  );
  const presentation = getAgendaStatusPresentation(event, now);
  const railClass = {
    planned: 'border-l-accent-primary-rail',
    warning: 'border-l-warning-rail',
    neutral: 'border-l-rail-neutral',
  }[presentation.rail];

  function openOccurrenceConfirmation() {
    if (event.status !== 'PLANNED') return;
    setOccurrenceTime(toDateTimeLocalValue(event.scheduledAt));
    setIsConfirmingOccurrence(true);
  }

  async function confirmOccurrence() {
    if (!onOccurEvent || !occurrenceTime || isActionPending) return;
    setIsActionPending(true);
    setActionError(null);
    try {
      const updatedEvent = await onOccurEvent(toCanonicalTimestamp(occurrenceTime));
      if (updatedEvent) setIsConfirmingOccurrence(false);
    } catch (error: unknown) {
      setActionError(t(getCarelogMessageKey(error)));
    } finally {
      setIsActionPending(false);
    }
  }

  async function cancelEvent() {
    if (!onCancelEvent || isActionPending) return;
    setIsActionPending(true);
    setActionError(null);
    try {
      await onCancelEvent();
    } catch (error: unknown) {
      setActionError(t(getCarelogMessageKey(error)));
    } finally {
      setIsActionPending(false);
    }
  }

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
                onClick={(clickEvent) => {
                  if (!onOpenCustomer) return;
                  clickEvent.preventDefault();
                  onOpenCustomer();
                }}
                className="text-accent-primary-deep inline-flex min-h-11 min-w-11 items-center font-semibold underline-offset-2 hover:underline"
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

        {onEdit || onCancelEvent || onOccurEvent ? (
          <div className="flex flex-wrap gap-2" data-event-actions>
            {onEdit ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                data-event-action="edit"
                onClick={() => setIsEditing(true)}
                disabled={isActionPending}
              >
                {t('eventDetail.edit')}
              </Button>
            ) : null}
            {event.status === 'PLANNED' && onOccurEvent ? (
              <Button
                type="button"
                variant="primary"
                size="sm"
                data-event-action="occur"
                onClick={openOccurrenceConfirmation}
                disabled={isActionPending}
              >
                {t('eventDetail.markOccurred')}
              </Button>
            ) : null}
            {event.status === 'PLANNED' && onCancelEvent ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-event-action="cancel"
                onClick={() => void cancelEvent()}
                disabled={isActionPending}
              >
                {t('eventDetail.cancel')}
              </Button>
            ) : null}
          </div>
        ) : null}

        {actionError ? (
          <p role="alert" className="text-warning text-sm font-semibold">
            {actionError}
          </p>
        ) : null}

        {isConfirmingOccurrence && event.status === 'PLANNED' && onOccurEvent ? (
          <section
            data-event-occurrence-confirmation
            className="border-border-default bg-subtle mt-4 rounded-lg border p-4"
          >
            <h2 className="text-text-primary text-sm font-semibold">
              {t('eventDetail.confirmOccurrence')}
            </h2>
            <label
              className="text-text-primary mt-3 grid gap-1.5 text-sm font-semibold"
              htmlFor="event-occurrence-time"
            >
              {t('eventDetail.actualTime')}
              <input
                id="event-occurrence-time"
                data-event-occurrence-time
                type="datetime-local"
                value={occurrenceTime}
                onChange={(inputEvent) => setOccurrenceTime(inputEvent.target.value)}
                required
                className="border-border-default bg-surface text-text-primary focus-visible:outline-accent-primary min-h-11 rounded-md border px-3 font-normal outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-event-occurrence-cancel
                onClick={() => setIsConfirmingOccurrence(false)}
                disabled={isActionPending}
              >
                {t('eventDetail.closeOccurrence')}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                data-event-occurrence-confirm
                onClick={() => void confirmOccurrence()}
                disabled={isActionPending}
              >
                {t('eventDetail.confirmOccurrenceAction')}
              </Button>
            </div>
          </section>
        ) : null}
      </div>

      {isEditing && onEdit ? (
        <EventForm
          mode="edit"
          event={event}
          customerName={customerName}
          now={now}
          onSubmit={async (values) => {
            await onEdit(values);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      ) : null}
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
        <time dateTime={timestamp}>{formatAgendaDateTime(timestamp, locale)}</time>
      </dd>
    </div>
  );
}
