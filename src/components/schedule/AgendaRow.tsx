import { useId } from 'react';
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

/**
 * 일정 한 행. 구조: 상태 레일(3px) · 시각(맨 앞) · 제목 / 메모 요약 1줄 / 고객 링크 · 상태.
 * - 시각이 가장 먼저 읽히도록 content-title 위계로 맨 앞에 둔다(표기는 기존 오전/오후 유지).
 * - 배지는 정리 필요·취소됨만. 예정·기록됨은 글자 라벨이라 상태를 색만으로 전달하지 않는다.
 * - 행 전체가 상세로 가는 대상(오버레이 버튼), 고객 이름은 별도 44px 링크. 중첩 컨트롤 없음.
 * - 오버레이 버튼 이름은 제목만 담으므로 시각·상태는 aria-describedby로 함께 읽힌다.
 */
export function AgendaRow({
  event,
  customerName,
  now,
  onOpen,
  isHighlighted = false,
}: AgendaRowProps) {
  const { locale, t } = useTranslation();
  const baseId = useId();
  const timeId = `${baseId}-time`;
  const statusId = `${baseId}-status`;
  const presentation = getAgendaStatusPresentation(event, now);
  const coordinate = getAgendaCoordinate(event);
  const title = getEventTitle(event) ?? t('schedule.untitled');
  const statusLabel = t(`schedule.meta.${presentation.meta}`);
  const railClass = {
    planned: 'bg-accent-primary-rail',
    warning: 'bg-warning-rail',
    // 중립 레일은 border(구분선) 대신 input 색 — 상태 표식이라 면 위에서 3:1(비텍스트)이 필요하다.
    neutral: 'bg-input',
  }[presentation.rail];
  const isCancelled = event.status === 'CANCELLED';

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
        'rounded-inset hover:bg-control relative min-h-14 py-3 pr-3 pl-5 text-left transition-colors',
        isHighlighted && 'event-highlight',
      )}
    >
      <span
        aria-hidden="true"
        data-agenda-rail={presentation.rail}
        className={cn(
          'absolute top-3 bottom-3 left-1 w-[var(--status-rail-width)] rounded-full',
          railClass,
        )}
      />
      <button
        type="button"
        aria-label={t('schedule.openEvent', { title })}
        aria-describedby={`${timeId} ${statusId}`}
        onClick={activate}
        className="focus-visible:outline-primary rounded-inset absolute inset-0 z-0 block h-full w-full cursor-pointer border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2"
      />

      <div className="pointer-events-none relative z-10 flex min-w-0 items-start gap-3">
        <time
          id={timeId}
          dateTime={coordinate}
          aria-hidden="true"
          className={cn(
            'type-content-title w-[4.75rem] shrink-0 break-keep',
            isCancelled ? 'text-text-secondary' : 'text-foreground',
          )}
        >
          {formatAgendaTime(coordinate, locale)}
        </time>

        <div className="flex min-w-0 flex-1 flex-col">
          <div aria-hidden="true" className="flex min-w-0 items-start justify-between gap-2">
            <h3
              className={cn(
                'type-content-title min-w-0 flex-1 wrap-anywhere break-keep',
                isCancelled ? 'text-text-secondary' : 'text-foreground',
              )}
            >
              {title}
            </h3>
            <span id={statusId} className="shrink-0 pt-0.5">
              {presentation.badge === 'overdue' ? (
                <Badge tone="overdue">{t('schedule.overdueBadge')}</Badge>
              ) : presentation.badge === 'cancelled' ? (
                <Badge tone="cancelled">{t('eventDetail.statusCancelled')}</Badge>
              ) : (
                <span
                  data-agenda-status={presentation.meta}
                  className={cn(
                    'type-meta font-semibold',
                    presentation.meta === 'planned' ? 'text-info' : 'text-text-tertiary',
                  )}
                >
                  {statusLabel}
                </span>
              )}
            </span>
          </div>

          {presentation.badge === 'overdue' ? (
            <p aria-hidden="true" className="type-meta text-warning">
              {statusLabel}
            </p>
          ) : null}

          {event.note && event.note !== title ? (
            <p className="type-supporting text-text-secondary line-clamp-1 break-keep">
              {event.note}
            </p>
          ) : null}

          <Link
            to={buildAppCustomerDetailPath(event.customerId)}
            onClick={(clickEvent) => clickEvent.stopPropagation()}
            onKeyDown={(keyboardEvent) => keyboardEvent.stopPropagation()}
            className="type-supporting text-brand-deep pointer-events-auto inline-flex min-h-11 w-fit max-w-full min-w-11 items-center font-semibold underline-offset-2 hover:underline"
          >
            <span className="wrap-anywhere break-keep">{customerName}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
