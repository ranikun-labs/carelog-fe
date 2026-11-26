/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState, type FormEvent } from 'react';

import { LeaveGuard } from '@/components/common/LeaveGuard';
import { getDefaultPlannedDateTimeLocal } from '@/components/schedule/agendaModel';
import { parseExistingLocalDateTime } from '@/components/schedule/localDateTime';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
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
  status?: 'PLANNED' | 'OCCURRED';
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
  /** "나가기"를 확정하면 호출된다. 부모가 들고 있는 임시 초안을 버리는 데 쓴다. */
  onDiscard?: () => void;
  onSubmit: (values: EventFormSubmitValues) => void | Promise<void>;
  onValidationFailure?: () => void;
  onCancel: () => void;
  /** 새 예정 일정의 과거 시각 검사 기준 시각. 테스트는 주입하고, 생략하면 제출 시점의 현재 시각을 쓴다. */
  getNow?: () => Date;
}

export function EventForm({
  mode,
  customerName,
  event,
  now,
  initialValues,
  fixedCreateStatus,
  onDraftChange,
  onDiscard,
  onSubmit,
  onValidationFailure,
  onCancel,
  getNow = () => new Date(),
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
      : toDateTimeLocalValue(initialValues?.scheduledAt ?? event?.scheduledAt ?? '') ||
          getDefaultPlannedDateTimeLocal(undefined, now),
  );
  const [occurredAt, setOccurredAt] = useState(
    event?.status === 'OCCURRED'
      ? toDateTimeLocalValue(event.occurredAt)
      : toDateTimeLocalValue(initialValues?.occurredAt ?? now.toISOString()),
  );
  const [error, setError] = useState<string | null>(null);
  const [timeErrorKind, setTimeErrorKind] = useState<'required' | 'past' | 'nonexistent' | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const lastFieldRef = useRef<HTMLElement | null>(null);
  const isEdit = mode === 'edit';
  const isOccurredEdit = event?.status === 'OCCURRED';
  const isFixedCreateStatus = !isEdit && fixedCreateStatus !== undefined;

  useEffect(() => {
    onDraftChange?.({ descriptor, note, scheduledAt, status, occurredAt });
  }, [descriptor, note, occurredAt, onDraftChange, scheduledAt, status]);

  // 만들기: 제목·메모가 비어 있지 않을 때. 수정: 원래 값과 달라졌을 때. 저장 중에는 놓아준다.
  const hasUnsavedInput = () => {
    if (submitLockRef.current) return false;
    if (!isEdit) return descriptor.trim() !== '' || note.trim() !== '';
    return (
      descriptor !== (event?.descriptor ?? '') ||
      note !== (event?.note ?? '') ||
      (event?.status === 'PLANNED' && scheduledAt !== toDateTimeLocalValue(event.scheduledAt)) ||
      (event?.status === 'OCCURRED' && occurredAt !== toDateTimeLocalValue(event.occurredAt))
    );
  };

  function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (submitLockRef.current) return;
    const time = status === 'PLANNED' ? scheduledAt : occurredAt;
    if (!time) {
      onValidationFailure?.();
      setTimeErrorKind('required');
      // noValidate라 브라우저가 첫 오류 입력으로 포커스를 옮겨 주지 않는다. 같은 동작을 직접 이어 준다.
      formEvent.currentTarget
        .querySelector<HTMLInputElement>(
          status === 'PLANNED'
            ? '[data-event-field="scheduledAt"]'
            : '[data-event-field="occurredAt"]',
        )
        ?.focus();
      return;
    }

    // 이 기기 시간대에 없는 시각(DST 건너뛴 구간)은 어떤 상태든 저장하지 않는다. 입력한 벽시계 값이 되돌아와야 한다.
    const parsedTime = parseExistingLocalDateTime(time);
    if (!parsedTime) {
      onValidationFailure?.();
      setTimeErrorKind('nonexistent');
      formEvent.currentTarget
        .querySelector<HTMLInputElement>(
          status === 'PLANNED'
            ? '[data-event-field="scheduledAt"]'
            : '[data-event-field="occurredAt"]',
        )
        ?.focus();
      return;
    }
    // 새 예정 일정만 제출 시점 기준으로 검사한다(현재 시각과 같은 분도 차단). 기본값은 항상 미래다.
    // 편집·즉시 기록(OCCURRED)은 과거 시각을 그대로 허용한다.
    if (!isEdit && status === 'PLANNED' && parsedTime.getTime() <= getNow().getTime()) {
      onValidationFailure?.();
      setTimeErrorKind('past');
      formEvent.currentTarget
        .querySelector<HTMLInputElement>('[data-event-field="scheduledAt"]')
        ?.focus();
      return;
    }

    setError(null);
    setTimeErrorKind(null);
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
        submitLockRef.current = false;
        setIsSubmitting(false);
      });
  }

  const timeLabel =
    status === 'PLANNED' ? t('eventForm.scheduledTime') : t('eventForm.occurredTime');
  const timeError =
    timeErrorKind === 'past'
      ? t('eventForm.scheduledInPast')
      : timeErrorKind === 'nonexistent'
        ? t('eventForm.timeNonexistent')
        : timeErrorKind === 'required'
        ? status === 'PLANNED'
          ? t('eventForm.scheduledRequired')
          : t('eventForm.occurredRequired')
        : undefined;

  return (
    <>
      <form
        data-event-form
        data-event-form-mode={mode}
        aria-busy={isSubmitting}
        noValidate
        onSubmit={submit}
        onFocusCapture={(focusEvent) => {
          if (focusEvent.target instanceof HTMLElement) lastFieldRef.current = focusEvent.target;
        }}
        className="bg-card rounded-card mt-4 min-w-0 p-4 sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="type-section-title text-foreground">
              {isEdit ? t('eventForm.editTitle') : t('eventForm.createTitle')}
            </h2>
            <p className="type-supporting text-text-secondary mt-1 wrap-anywhere break-keep">
              {t('eventForm.customer', { customer: customerName })}
            </p>
          </div>
          <Button
            type="button"
            variant="text-neutral"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
            data-event-form-cancel
          >
            {t('eventForm.cancel')}
          </Button>
        </div>

        {!isEdit && !isFixedCreateStatus ? (
          <fieldset className="mt-4 min-w-0">
            <legend className="type-content-title text-foreground">
              {t('eventForm.kindLabel')}
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {(
                [
                  ['PLANNED', t('eventForm.planned')],
                  ['OCCURRED', t('eventForm.immediateOccurred')],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={cn(
                    'rounded-control type-body flex min-h-11 cursor-pointer items-center gap-2 px-3 font-semibold',
                    'has-[:disabled]:cursor-default has-[:disabled]:opacity-50',
                    status === value
                      ? 'bg-brand-subtle text-brand-deep'
                      : 'bg-control text-foreground',
                  )}
                >
                  <input
                    type="radio"
                    name="event-kind"
                    value={value}
                    checked={status === value}
                    disabled={isSubmitting}
                    onChange={() => {
                      setStatus(value);
                      setTimeErrorKind(null);
                    }}
                    className="accent-primary size-5 shrink-0"
                  />
                  <span className="min-w-0 wrap-anywhere break-keep">{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <div className="mt-5 grid gap-5">
          <TextField
            id="event-descriptor"
            name="descriptor"
            data-event-field="descriptor"
            label={t('eventForm.descriptor')}
            value={descriptor}
            onChange={(inputEvent) => setDescriptor(inputEvent.target.value)}
            placeholder={t('eventForm.descriptorPlaceholder')}
          />

          <TextField
            key={status}
            id={status === 'PLANNED' ? 'event-scheduled-at' : 'event-occurred-at'}
            name={status === 'PLANNED' ? 'scheduledAt' : 'occurredAt'}
            data-event-field={status === 'PLANNED' ? 'scheduledAt' : 'occurredAt'}
            type="datetime-local"
            label={timeLabel}
            value={status === 'PLANNED' ? scheduledAt : occurredAt}
            onChange={(inputEvent) => {
              const next = inputEvent.target.value;
              if (status === 'PLANNED') setScheduledAt(next);
              else setOccurredAt(next);
              if (next) setTimeErrorKind(null);
            }}
            required
            hint={
              isOccurredEdit && event?.scheduledAt
                ? t('eventForm.originalScheduledPreserved')
                : undefined
            }
            error={timeError}
          />

          <TextField
            multiline
            id="event-note"
            name="note"
            data-event-field="note"
            label={t('eventForm.note')}
            value={note}
            onChange={(inputEvent) => setNote(inputEvent.target.value)}
            rows={3}
            placeholder={t('eventForm.notePlaceholder')}
          />
        </div>

        {error ? (
          <Notice tone="danger" className="mt-4" data-event-form-error>
            {error}
          </Notice>
        ) : null}

        <div
          className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
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
      <LeaveGuard
        shouldBlock={hasUnsavedInput}
        onLeave={onDiscard}
        restoreFocusTo={() => lastFieldRef.current}
      />
    </>
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
