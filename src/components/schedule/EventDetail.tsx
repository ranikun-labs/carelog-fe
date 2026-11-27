import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getCarelogMessageKey } from '@/integrations/carelog/errorMapping';
import { useOptionalSaveSession } from '@/state/saveSessionContext';
import {
  EventForm,
  toDateTimeLocalValue,
  toStoredTimestamp,
  type EventFormSubmitOptions,
  type EventFormSubmitValues,
} from '@/components/schedule/EventForm';
import { parseExistingLocalDateTime } from '@/components/schedule/localDateTime';
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
  onOpenAssistant?: () => void;
  onEdit?: (
    values: EventFormSubmitValues,
    options: EventFormSubmitOptions,
  ) => CustomerEvent | undefined | Promise<CustomerEvent | undefined>;
  /** 편집 폼의 저장 세션 키(업무 대상). */
  saveKey?: string;
  onCancelEvent?: () => CustomerEvent | undefined | Promise<CustomerEvent | undefined>;
  onOccurEvent?: (
    occurredAt: string,
  ) => CustomerEvent | undefined | Promise<CustomerEvent | undefined>;
  /** 고객 상세의 "기록 완료"로 들어왔을 때, 실제 시각 확인 패널을 열고 시작한다. */
  startWithOccurrenceConfirmation?: boolean;
}

export function EventDetail({
  event,
  customerName,
  customerPath,
  now,
  onOpenCustomer,
  onOpenAssistant,
  onEdit,
  saveKey,
  onCancelEvent,
  onOccurEvent,
  startWithOccurrenceConfirmation = false,
}: EventDetailProps) {
  const { locale, t } = useTranslation();
  // 저장 중이거나 실패가 남아 있으면 재마운트 뒤에도 편집 폼을 연다(입력·오류는 EventForm이 공급자에서 복구).
  const session = useOptionalSaveSession();
  const [isEditing, setIsEditing] = useState(() =>
    Boolean(
      session &&
      saveKey &&
      ['saving', 'failed'].includes(session.saveRecordFor(saveKey)?.status ?? ''),
    ),
  );
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const cancelTriggerRef = useRef<HTMLButtonElement>(null);
  const cancelCloseRef = useRef<HTMLButtonElement>(null);
  // 같은 tick 안의 이중 클릭은 setState 반영 전이라 isActionPending으로 막을 수 없다. ref로 즉시 잠근다.
  const cancelLockRef = useRef(false);
  const [isConfirmingOccurrence, setIsConfirmingOccurrence] = useState(
    startWithOccurrenceConfirmation && event.status === 'PLANNED' && Boolean(onOccurEvent),
  );
  const occurrenceTriggerRef = useRef<HTMLButtonElement>(null);
  const occurrenceInputRef = useRef<HTMLInputElement>(null);
  const [isActionPending, setIsActionPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [occurrenceFieldError, setOccurrenceFieldError] = useState<string | null>(null);
  const [occurrenceTime, setOccurrenceTime] = useState(
    event.status === 'PLANNED' ? toDateTimeLocalValue(event.scheduledAt) : '',
  );
  const presentation = getAgendaStatusPresentation(event, now);
  const railClass = {
    planned: 'bg-accent-primary-rail',
    warning: 'bg-warning-rail',
    // 중립 레일은 border(구분선) 대신 input 색 — 상태 표식이라 면 위에서 3:1(비텍스트)이 필요하다.
    neutral: 'bg-input',
  }[presentation.rail];

  // 확인 패널이 열리면 첫 입력(실제 시각)으로 포커스를 옮긴다. 닫을 때의 트리거 복귀는 닫기 핸들러가 맡는다.
  useEffect(() => {
    if (isConfirmingOccurrence) occurrenceInputRef.current?.focus();
  }, [isConfirmingOccurrence]);

  // 취소 확인 패널이 열리면 안전한 쪽(닫기)에 포커스를 둔다. Enter 한 번에 취소되지 않게 한다.
  useEffect(() => {
    if (isConfirmingCancel) cancelCloseRef.current?.focus();
  }, [isConfirmingCancel]);

  function openOccurrenceConfirmation() {
    if (event.status !== 'PLANNED') return;
    setIsConfirmingCancel(false);
    setOccurrenceTime(toDateTimeLocalValue(event.scheduledAt));
    setIsConfirmingOccurrence(true);
  }

  async function confirmOccurrence() {
    if (!onOccurEvent || !occurrenceTime || isActionPending) return;
    // 이 기기 시간대에 없는 시각(DST 건너뛴 구간)은 저장하지 않는다. 입력은 유지하고 필드에 오류를 보인다.
    if (!parseExistingLocalDateTime(occurrenceTime)) {
      setOccurrenceFieldError(t('eventForm.timeNonexistent'));
      occurrenceInputRef.current?.focus();
      return;
    }
    setOccurrenceFieldError(null);
    setIsActionPending(true);
    setActionError(null);
    try {
      // 시각을 바꾸지 않았으면 원래 timestamp(DST 중복 오프셋 포함)를 그대로 보낸다.
      const updatedEvent = await onOccurEvent(toStoredTimestamp(occurrenceTime, event.scheduledAt));
      if (updatedEvent) setIsConfirmingOccurrence(false);
    } catch (error: unknown) {
      setActionError(t(getCarelogMessageKey(error)));
    } finally {
      setIsActionPending(false);
    }
  }

  async function cancelEvent() {
    if (!onCancelEvent || isActionPending || cancelLockRef.current) return;
    cancelLockRef.current = true;
    setIsActionPending(true);
    setActionError(null);
    try {
      await onCancelEvent();
    } catch (error: unknown) {
      setActionError(t(getCarelogMessageKey(error)));
    } finally {
      cancelLockRef.current = false;
      setIsActionPending(false);
    }
  }

  const isOverdue = event.status === 'PLANNED' && presentation.badge === 'overdue';
  const hasActions = Boolean(onEdit || onCancelEvent || onOccurEvent || onOpenAssistant);

  return (
    <article
      data-event-detail
      data-event-status={event.status}
      className="flex min-w-0 flex-col gap-4"
    >
      {/* Key Block: 상태 + 시각. 이 화면에서 가장 먼저 읽혀야 하는 "언제, 어떤 상태"다. */}
      <section
        data-event-key
        className="bg-inset rounded-card relative flex flex-col gap-3 py-4 pr-4 pl-5"
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-4 bottom-4 left-1 w-[var(--status-rail-width)] rounded-full',
            railClass,
          )}
        />
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
          {event.status === 'OCCURRED' ? (
            <>
              <span className="type-label text-text-secondary">{t('schedule.meta.occurred')}</span>
              {event.descriptor ? (
                <span className="type-label text-text-secondary wrap-anywhere break-keep">
                  {event.descriptor}
                </span>
              ) : null}
            </>
          ) : null}
        </div>

        <dl className="flex flex-col gap-2">
          <TimeContext event={event} locale={locale} />
        </dl>

        {isOverdue ? (
          <p className="bg-warning-bg text-warning rounded-inset type-label px-3 py-2">
            {t('schedule.overdueMeta')}
          </p>
        ) : null}
      </section>

      {event.note ? (
        <section className="bg-inset rounded-card p-4">
          <h2 className="type-label text-text-secondary">{t('eventDetail.memo')}</h2>
          <p className="type-reading text-foreground mt-1 wrap-anywhere break-keep whitespace-pre-line">
            {event.note}
          </p>
        </section>
      ) : null}

      <section className="bg-inset rounded-card px-4">
        <dl>
          <div className="flex items-center justify-between gap-4 py-1">
            <dt className="type-supporting text-text-secondary shrink-0">
              {t('eventDetail.customer')}
            </dt>
            <dd className="min-w-0">
              <Link
                to={customerPath}
                onClick={(clickEvent) => {
                  if (!onOpenCustomer) return;
                  clickEvent.preventDefault();
                  onOpenCustomer();
                }}
                className="type-body text-brand-deep inline-flex min-h-11 min-w-11 items-center font-semibold underline-offset-2 hover:underline"
              >
                <span className="wrap-anywhere break-keep">{customerName}</span>
              </Link>
            </dd>
          </div>
        </dl>
      </section>

      {hasActions ? (
        <div className="flex flex-wrap items-center gap-2" data-event-actions>
          {/* 행동 강도: 정리 필요(지난 예정)에서만 Strong 1. 확인 패널이 열리면 Strong은 패널의 "확인"으로 넘어간다. */}
          {event.status === 'PLANNED' && onOccurEvent ? (
            <Button
              ref={occurrenceTriggerRef}
              type="button"
              variant={isOverdue && !isConfirmingOccurrence ? 'strong' : 'subtle'}
              size="sm"
              data-event-action="occur"
              onClick={openOccurrenceConfirmation}
              disabled={isActionPending}
            >
              {t('eventDetail.markOccurred')}
            </Button>
          ) : null}
          {event.status === 'PLANNED' && onOpenAssistant ? (
            <Button
              type="button"
              variant="text"
              size="sm"
              data-assistant-entry="planned-event"
              onClick={onOpenAssistant}
            >
              {t('eventDetail.prepareAssistant')}
            </Button>
          ) : null}
          {event.status === 'OCCURRED' && onOpenAssistant ? (
            <Button
              type="button"
              variant="text"
              size="sm"
              data-assistant-entry="occurred-event"
              onClick={onOpenAssistant}
            >
              {t('eventDetail.askAboutRecord')}
            </Button>
          ) : null}
          {onEdit ? (
            <Button
              type="button"
              variant="text"
              size="sm"
              data-event-action="edit"
              onClick={() => setIsEditing(true)}
              disabled={isActionPending}
            >
              {t('eventDetail.edit')}
            </Button>
          ) : null}
          {event.status === 'PLANNED' && onCancelEvent ? (
            <Button
              ref={cancelTriggerRef}
              type="button"
              variant="text-neutral"
              size="sm"
              className="ml-auto"
              aria-expanded={isConfirmingCancel}
              data-event-action="cancel"
              onClick={() => {
                setIsConfirmingOccurrence(false);
                setActionError(null);
                setIsConfirmingCancel(true);
              }}
              disabled={isActionPending}
            >
              {t('eventDetail.cancel')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {actionError ? (
        <p role="alert" className="bg-warning-bg text-warning rounded-inset type-label px-3 py-2">
          {actionError}
        </p>
      ) : null}

      {isConfirmingCancel && event.status === 'PLANNED' && onCancelEvent ? (
        <section
          data-event-cancel-confirmation
          className="bg-inset rounded-card flex flex-col gap-3 p-4"
        >
          <h2 className="type-content-title text-foreground">
            {t('eventDetail.cancelConfirmTitle')}
          </h2>
          <p className="type-body text-text-secondary break-keep">
            {t('eventDetail.cancelConfirmBody', {
              time: formatAgendaDateTime(getAgendaCoordinate(event), locale),
            })}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              ref={cancelCloseRef}
              type="button"
              variant="neutral"
              size="sm"
              data-event-cancel-close
              onClick={() => {
                setIsConfirmingCancel(false);
                cancelTriggerRef.current?.focus();
              }}
              disabled={isActionPending}
            >
              {t('eventDetail.cancelConfirmClose')}
            </Button>
            {/* 확정만 위험색. 확정 전에는 상태가 바뀌지 않는다. */}
            <Button
              type="button"
              variant="danger-strong"
              size="sm"
              data-event-cancel-confirm
              onClick={() => void cancelEvent()}
              disabled={isActionPending}
            >
              {t('eventDetail.cancelConfirmAction')}
            </Button>
          </div>
        </section>
      ) : null}

      {isConfirmingOccurrence && event.status === 'PLANNED' && onOccurEvent ? (
        <section
          data-event-occurrence-confirmation
          className="bg-inset rounded-card flex flex-col gap-3 p-4"
        >
          <h2 className="type-content-title text-foreground">
            {t('eventDetail.confirmOccurrence')}
          </h2>
          <label
            className="type-label text-text-secondary grid gap-1.5"
            htmlFor="event-occurrence-time"
          >
            {t('eventDetail.actualTime')}
            <input
              ref={occurrenceInputRef}
              id="event-occurrence-time"
              data-event-occurrence-time
              type="datetime-local"
              value={occurrenceTime}
              onChange={(inputEvent) => {
                setOccurrenceTime(inputEvent.target.value);
                setOccurrenceFieldError(null);
              }}
              required
              aria-invalid={occurrenceFieldError ? true : undefined}
              aria-describedby={occurrenceFieldError ? 'event-occurrence-time-error' : undefined}
              className="border-input bg-card type-body text-foreground rounded-control min-h-11 w-full min-w-0 border px-3 font-normal"
            />
          </label>
          {occurrenceFieldError ? (
            <p id="event-occurrence-time-error" role="alert" className="type-label text-warning">
              {occurrenceFieldError}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="text-neutral"
              size="sm"
              data-event-occurrence-cancel
              onClick={() => {
                setIsConfirmingOccurrence(false);
                occurrenceTriggerRef.current?.focus();
              }}
              disabled={isActionPending}
            >
              {t('eventDetail.closeOccurrence')}
            </Button>
            <Button
              type="button"
              variant="strong"
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

      {isEditing && onEdit ? (
        <EventForm
          mode="edit"
          event={event}
          customerName={customerName}
          now={now}
          saveKey={saveKey}
          onSubmit={async (values, options) => {
            await onEdit(values, options);
            // 저장 응답이 늦게 와도 지금 이 편집 폼의 응답일 때만 닫는다(다른 일정 B의 편집 폼을 닫지 않는다).
            if (!options.isCurrent || options.isCurrent()) setIsEditing(false);
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
          primary
        />
      );
    }

    if (hasSameInstant(event.scheduledAt, event.occurredAt)) {
      return (
        <TimeItem
          label={t('eventDetail.time')}
          timestamp={event.occurredAt}
          locale={locale}
          primary
        />
      );
    }

    // 원래 예정 시각은 보존해 위(보조)에, 실제 시각을 Key로 아래에 둔다(시간 순서).
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
          primary
        />
      </>
    );
  }

  return (
    <TimeItem
      label={t('eventDetail.scheduledTime')}
      timestamp={getAgendaCoordinate(event)}
      locale={locale}
      primary={event.status === 'PLANNED'}
    />
  );
}

/** 화면당 key-value 1개: primary 시각만 20px. 취소됨은 원래 예정 시각을 보존해 보여 주되 Key로 키우지 않는다. */
function TimeItem({
  label,
  timestamp,
  locale,
  primary = false,
}: {
  label: string;
  timestamp: string;
  locale: string;
  primary?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="type-label text-text-secondary">{label}</dt>
      <dd
        className={cn(
          'break-keep',
          primary ? 'type-key-value text-foreground' : 'type-body text-text-secondary',
        )}
      >
        <time dateTime={timestamp}>{formatAgendaDateTime(timestamp, locale)}</time>
      </dd>
    </div>
  );
}
