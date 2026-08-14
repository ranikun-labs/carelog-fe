/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import type { CustomerEvent } from '@/domain/customerEvent';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import type { EventFormDraft } from '@/state/EventCreateDraftContext';

export type EventFormMode = 'create' | 'edit';

export interface EventFormSubmitValues {
  status: 'PLANNED' | 'OCCURRED';
  descriptor: string;
  note: string;
  scheduledAt?: string;
  occurredAt?: string;
}

export interface EventFormInitialValues {
  descriptor?: string;
  note?: string;
  scheduledAt?: string;
  occurredAt?: string;
}

interface EventFormProps {
  mode: EventFormMode;
  customerName: string;
  event?: CustomerEvent;
  now: Date;
  initialValues?: EventFormInitialValues;
  fixedCreateStatus?: 'PLANNED';
  onDraftChange?: (draft: EventFormDraft) => void;
  onSubmit: (values: EventFormSubmitValues) => void;
  onValidationFailure?: () => void;
  onCancel: () => void;
}

export function EventForm({
  mode,
  customerName,
  event,
  now,
  initialValues,
  fixedCreateStatus,
  onDraftChange,
  onSubmit,
  onValidationFailure,
  onCancel,
}: EventFormProps) {
  const { t } = useTranslation();
  const initialStatus =
    event?.status === 'OCCURRED' ? 'OCCURRED' : (fixedCreateStatus ?? 'PLANNED');
  const [status, setStatus] = useState<'PLANNED' | 'OCCURRED'>(initialStatus);
  const [descriptor, setDescriptor] = useState(
    event?.descriptor ?? initialValues?.descriptor ?? '',
  );
  const [note, setNote] = useState(event?.note ?? initialValues?.note ?? '');
  const [scheduledAt, setScheduledAt] = useState(
    event?.status === 'PLANNED'
      ? toDateTimeLocalValue(event.scheduledAt)
      : toDateTimeLocalValue(initialValues?.scheduledAt ?? event?.scheduledAt ?? '') ||
          toDateTimeLocalValue(now.toISOString()),
  );
  const [occurredAt, setOccurredAt] = useState(
    event?.status === 'OCCURRED'
      ? toDateTimeLocalValue(event.occurredAt)
      : toDateTimeLocalValue(initialValues?.occurredAt ?? now.toISOString()),
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const isEdit = mode === 'edit';
  const isOccurredEdit = event?.status === 'OCCURRED';
  const isFixedCreateStatus = !isEdit && fixedCreateStatus !== undefined;

  useEffect(() => {
    onDraftChange?.({ descriptor, note, scheduledAt });
  }, [descriptor, note, onDraftChange, scheduledAt]);

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (submitLockRef.current) return;
    const time = status === 'PLANNED' ? scheduledAt : occurredAt;
    if (!time) {
      onValidationFailure?.();
      setError(
        status === 'PLANNED' ? t('eventForm.scheduledRequired') : t('eventForm.occurredRequired'),
      );
      return;
    }

    setError(null);
    submitLockRef.current = true;
    setIsSubmitting(true);
    onSubmit({
      status,
      descriptor: descriptor.trim(),
      note: note.trim(),
      ...(status === 'PLANNED'
        ? { scheduledAt: toCanonicalTimestamp(scheduledAt) }
        : { occurredAt: toCanonicalTimestamp(occurredAt) }),
    });
  }

  return (
    <form
      data-event-form
      data-event-form-mode={mode}
      aria-busy={isSubmitting}
      onSubmit={submit}
      onInvalidCapture={() => onValidationFailure?.()}
      className="border-border-default bg-surface mt-4 rounded-lg border p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-text-primary text-base font-semibold">
            {isEdit ? t('eventForm.editTitle') : t('eventForm.createTitle')}
          </h2>
          <p className="text-text-secondary mt-1 text-sm">
            {t('eventForm.customer', { customer: customerName })}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSubmitting}
          data-event-form-cancel
        >
          {t('eventForm.cancel')}
        </Button>
      </div>

      {!isEdit && !isFixedCreateStatus ? (
        <fieldset className="mt-4">
          <legend className="text-text-primary text-sm font-semibold">
            {t('eventForm.kindLabel')}
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label
              className={cn(
                'border-border-default flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm',
                status === 'PLANNED' && 'border-accent-primary bg-accent-primary-bg',
              )}
            >
              <input
                type="radio"
                name="event-kind"
                value="PLANNED"
                checked={status === 'PLANNED'}
                onChange={() => setStatus('PLANNED')}
              />
              <span>{t('eventForm.planned')}</span>
            </label>
            <label
              className={cn(
                'border-border-default flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm',
                status === 'OCCURRED' && 'border-accent-primary bg-accent-primary-bg',
              )}
            >
              <input
                type="radio"
                name="event-kind"
                value="OCCURRED"
                checked={status === 'OCCURRED'}
                onChange={() => setStatus('OCCURRED')}
              />
              <span>{t('eventForm.immediateOccurred')}</span>
            </label>
          </div>
        </fieldset>
      ) : null}

      <div className="mt-4 grid gap-4">
        <label className="grid gap-1.5 text-sm font-semibold" htmlFor="event-descriptor">
          {t('eventForm.descriptor')}
          <input
            id="event-descriptor"
            name="descriptor"
            data-event-field="descriptor"
            value={descriptor}
            onChange={(inputEvent) => setDescriptor(inputEvent.target.value)}
            className="border-border-default bg-surface text-text-primary focus-visible:outline-accent-primary min-h-11 rounded-md border px-3 font-normal outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            placeholder={t('eventForm.descriptorPlaceholder')}
          />
        </label>

        {status === 'PLANNED' ? (
          <label className="grid gap-1.5 text-sm font-semibold" htmlFor="event-scheduled-at">
            {t('eventForm.scheduledTime')}
            <input
              id="event-scheduled-at"
              name="scheduledAt"
              data-event-field="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(inputEvent) => setScheduledAt(inputEvent.target.value)}
              required
              className="border-border-default bg-surface text-text-primary focus-visible:outline-accent-primary min-h-11 rounded-md border px-3 font-normal outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </label>
        ) : (
          <label className="grid gap-1.5 text-sm font-semibold" htmlFor="event-occurred-at">
            {t('eventForm.occurredTime')}
            <input
              id="event-occurred-at"
              name="occurredAt"
              data-event-field="occurredAt"
              type="datetime-local"
              value={occurredAt}
              onChange={(inputEvent) => setOccurredAt(inputEvent.target.value)}
              required
              className="border-border-default bg-surface text-text-primary focus-visible:outline-accent-primary min-h-11 rounded-md border px-3 font-normal outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </label>
        )}

        {isOccurredEdit && event?.scheduledAt ? (
          <p className="text-text-tertiary text-xs">{t('eventForm.originalScheduledPreserved')}</p>
        ) : null}

        <label className="grid gap-1.5 text-sm font-semibold" htmlFor="event-note">
          {t('eventForm.note')}
          <textarea
            id="event-note"
            name="note"
            data-event-field="note"
            value={note}
            onChange={(inputEvent) => setNote(inputEvent.target.value)}
            rows={3}
            className="border-border-default bg-surface text-text-primary focus-visible:outline-accent-primary rounded-md border px-3 py-2 font-normal outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            placeholder={t('eventForm.notePlaceholder')}
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-warning mt-3 text-sm font-semibold">
          {error}
        </p>
      ) : null}

      <div
        className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
        data-event-form-actions
      >
        <Button
          type="submit"
          className="w-full sm:w-auto"
          data-event-form-submit
          disabled={isSubmitting}
        >
          {isEdit ? t('eventForm.save') : t('eventForm.create')}
        </Button>
      </div>
    </form>
  );
}

export function toDateTimeLocalValue(timestamp: string): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp.slice(0, 16);

  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toCanonicalTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?$/.test(value)) {
    return value;
  }

  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  const pad = (number: number) => String(number).padStart(2, '0');
  const offset = `${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`;
  return `${value.length === 16 ? `${value}:00` : value}${offset}`;
}
