/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import type { CustomerEvent } from '@/domain/customerEvent';
import { getCarelogMessageKey } from '@/integrations/carelog/errorMapping';
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
  status?: 'PLANNED' | 'OCCURRED';
}

interface EventFormProps {
  mode: EventFormMode;
  customerName: string;
  event?: CustomerEvent;
  now: Date;
  initialValues?: EventFormInitialValues;
  fixedCreateStatus?: 'PLANNED';
  onDraftChange?: (draft: EventFormDraft) => void;
  onSubmit: (values: EventFormSubmitValues) => void | Promise<void>;
  externalSubmitting?: boolean;
  externalError?: string | null;
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
  externalSubmitting = false,
  externalError,
  onCancel,
}: EventFormProps) {
  const { t } = useTranslation();
  const initialStatus =
    event?.status === 'OCCURRED'
      ? 'OCCURRED'
      : (fixedCreateStatus ?? initialValues?.status ?? 'PLANNED');
  const [status, setStatus] = useState<'PLANNED' | 'OCCURRED'>(initialStatus);
  const [descriptor, setDescriptor] = useState(
    event?.descriptor ?? initialValues?.descriptor ?? '',
  );
  const [note, setNote] = useState(event?.note ?? initialValues?.note ?? '');
  const [scheduledAt, setScheduledAt] = useState(
    event?.status === 'PLANNED'
      ? toDateTimeLocalValue(event.scheduledAt)
      : initialValues?.status !== undefined
        ? toDateTimeLocalValue(initialValues.scheduledAt ?? '')
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
  const [submitFailed, setSubmitFailed] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const submitLockRef = useRef(false);
  const isEdit = mode === 'edit';
  const isOccurredEdit = event?.status === 'OCCURRED';
  const isFixedCreateStatus = !isEdit && fixedCreateStatus !== undefined;

  useEffect(() => {
    onDraftChange?.({ descriptor, note, scheduledAt, status, occurredAt });
  }, [descriptor, note, onDraftChange, scheduledAt, status, occurredAt]);

  useEffect(() => {
    if (
      (submitFailed || externalError) &&
      (document.activeElement === document.body || document.activeElement === submitRef.current)
    ) {
      errorRef.current?.focus();
    }
  }, [submitFailed, externalError]);

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (submitLockRef.current || externalSubmitting) return;
    const time = status === 'PLANNED' ? scheduledAt : occurredAt;
    if (!time) {
      onValidationFailure?.();
      setError(
        status === 'PLANNED' ? t('eventForm.scheduledRequired') : t('eventForm.occurredRequired'),
      );
      return;
    }

    setError(null);
    setSubmitFailed(false);
    submitLockRef.current = true;
    setIsSubmitting(true);
    void Promise.resolve()
      .then(() =>
        onSubmit({
          status,
          descriptor: descriptor.trim(),
          note: note.trim(),
          ...(status === 'PLANNED'
            ? { scheduledAt: toCanonicalTimestamp(scheduledAt) }
            : { occurredAt: toCanonicalTimestamp(occurredAt) }),
        }),
      )
      .catch((submitError: unknown) => {
        setError(t(getCarelogMessageKey(submitError)));
        setSubmitFailed(true);
        submitLockRef.current = false;
        setIsSubmitting(false);
      });
  }

  return (
    <form
      data-event-form
      data-event-form-mode={mode}
      aria-busy={isSubmitting || externalSubmitting}
      onSubmit={submit}
      onInvalidCapture={() => onValidationFailure?.()}
      className="border-border-subtle bg-surface mt-4 min-w-0 rounded-xl border p-5 sm:p-7"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-text-primary text-lg font-bold tracking-tight">
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
          disabled={isSubmitting || externalSubmitting}
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

      <div className="mt-6 grid gap-6">
        <label className="grid gap-2 text-sm font-semibold" htmlFor="event-descriptor">
          {t('eventForm.descriptor')}
          <input
            id="event-descriptor"
            name="descriptor"
            data-event-field="descriptor"
            value={descriptor}
            onChange={(inputEvent) => setDescriptor(inputEvent.target.value)}
            className="border-border-default bg-surface text-text-primary focus-visible:outline-accent-primary min-h-[50px] w-full min-w-0 rounded-lg border px-3 font-normal outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            placeholder={t('eventForm.descriptorPlaceholder')}
          />
        </label>

        {status === 'PLANNED' ? (
          <label className="grid gap-2 text-sm font-semibold" htmlFor="event-scheduled-at">
            {t('eventForm.scheduledTime')}
            <input
              id="event-scheduled-at"
              name="scheduledAt"
              data-event-field="scheduledAt"
              type="datetime-local"
              value={scheduledAt}
              onChange={(inputEvent) => setScheduledAt(inputEvent.target.value)}
              required
              className="border-border-default bg-surface text-text-primary focus-visible:outline-accent-primary min-h-[50px] w-full min-w-0 rounded-lg border px-3 font-normal outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </label>
        ) : (
          <label className="grid gap-2 text-sm font-semibold" htmlFor="event-occurred-at">
            {t('eventForm.occurredTime')}
            <input
              id="event-occurred-at"
              name="occurredAt"
              data-event-field="occurredAt"
              type="datetime-local"
              value={occurredAt}
              onChange={(inputEvent) => setOccurredAt(inputEvent.target.value)}
              required
              className="border-border-default bg-surface text-text-primary focus-visible:outline-accent-primary min-h-[50px] w-full min-w-0 rounded-lg border px-3 font-normal outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            />
          </label>
        )}

        {isOccurredEdit && event?.scheduledAt ? (
          <p className="text-text-tertiary text-xs">{t('eventForm.originalScheduledPreserved')}</p>
        ) : null}

        <label className="grid gap-2 text-sm font-semibold" htmlFor="event-note">
          {t('eventForm.note')}
          <textarea
            id="event-note"
            name="note"
            data-event-field="note"
            value={note}
            onChange={(inputEvent) => setNote(inputEvent.target.value)}
            rows={3}
            className="border-border-default bg-surface text-text-primary focus-visible:outline-accent-primary min-h-24 w-full min-w-0 rounded-lg border px-3 py-3 font-normal outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            placeholder={t('eventForm.notePlaceholder')}
          />
        </label>
      </div>

      {error || externalError ? (
        <p
          ref={errorRef}
          role="alert"
          tabIndex={-1}
          className="text-warning mt-3 text-sm font-semibold"
        >
          {submitFailed || externalError
            ? `${t('eventForm.saveFailed')} ${error ?? externalError}`
            : error}
        </p>
      ) : null}

      <div
        className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
        data-event-form-actions
      >
        <Button
          ref={submitRef}
          type="submit"
          className="min-h-12 w-full sm:w-auto sm:min-w-36"
          data-event-form-submit
          disabled={isSubmitting || externalSubmitting}
        >
          {isSubmitting || externalSubmitting
            ? t('eventForm.saving')
            : submitFailed || externalError
              ? t('eventForm.retrySave')
              : isEdit
                ? t('eventForm.save')
                : t('eventForm.create')}
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
