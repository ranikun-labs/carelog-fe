import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { getEventTitle, formatAgendaDateTime } from '@/components/schedule/agendaModel';
import { getUpcomingCustomerEvents } from '@/components/customers/customerDetailModel';
import { Badge } from '@/components/ui/badge';
import { buildAppEventDetailPath } from '@/constants/routes';
import type { CustomerEvent } from '@/domain/customerEvent';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';

interface CustomerUpcomingProps {
  events: readonly CustomerEvent[];
  now: Date;
  onOpenEvent?: (event: CustomerEvent) => void;
  /** Key Block 안 맨 아래 행동(일정 추가). 다음 일정이 없어도 같은 자리에 선다. */
  action?: ReactNode;
  /**
   * false면 다음 일정 내용(제목·Key Block)은 그리지 않고 행동만 같은 자리에 둔다.
   * 로딩·실패 중에도 "일정 추가"가 같은 DOM 자리를 지켜야 사용자가 옮긴 포커스가 유지된다.
   */
  ready?: boolean;
}

export function CustomerUpcoming({
  events,
  now,
  onOpenEvent,
  action,
  ready = true,
}: CustomerUpcomingProps) {
  const { locale, t } = useTranslation();
  const upcomingEvents = getUpcomingCustomerEvents(events, now);
  const [primaryEvent, ...additionalEvents] = upcomingEvents;

  const hasPrimary = ready && primaryEvent !== undefined;

  return (
    <section
      className="mt-8"
      data-customer-upcoming
      aria-labelledby={ready ? 'customer-upcoming-title' : undefined}
    >
      {ready ? (
        <h2 id="customer-upcoming-title" className="type-section-title text-foreground break-keep">
          {t('customers.detail.upcomingTitle')}
        </h2>
      ) : null}

      {/* 래퍼는 세 상태(Key Block·없음·준비 전)에서 같은 자리라, 안의 행동 버튼이 다시 마운트되지 않는다. */}
      <div
        {...(hasPrimary ? { 'data-upcoming-key': '' } : {})}
        {...(ready && !primaryEvent ? { 'data-customer-upcoming-empty': '' } : {})}
        className={cn(
          'flex flex-col gap-3',
          ready && 'bg-inset rounded-card mt-2',
          hasPrimary ? 'relative py-4 pr-4 pl-5' : ready ? 'p-4' : '',
        )}
      >
        {/* Key Block: 상태 + 제목 + 시각(key-value) + 행동. 고객 상세에서 가장 먼저 읽혀야 하는 "다음에 언제"다. */}
        {hasPrimary ? (
          <>
            <span
              aria-hidden="true"
              className="bg-accent-primary-rail absolute top-4 bottom-4 left-1 w-[var(--status-rail-width)] rounded-full"
            />
            <Link
              to={buildAppEventDetailPath(primaryEvent.id)}
              onClick={(clickEvent) => {
                if (!onOpenEvent) return;
                clickEvent.preventDefault();
                onOpenEvent(primaryEvent);
              }}
              aria-label={t('schedule.openEvent', {
                title: getEventTitle(primaryEvent) ?? t('schedule.untitled'),
              })}
              data-upcoming-primary
              className="hover:bg-control rounded-inset -m-2 flex min-w-0 flex-col items-start gap-2 p-2 transition-colors"
            >
              <Badge tone="planned">{t('schedule.meta.planned')}</Badge>
              <h3 className="type-content-title text-foreground w-full min-w-0 wrap-anywhere break-keep">
                {getEventTitle(primaryEvent) ?? t('schedule.untitled')}
              </h3>
              <time
                dateTime={primaryEvent.scheduledAt}
                className="type-key-value text-foreground block break-keep"
              >
                {formatAgendaDateTime(primaryEvent.scheduledAt, locale)}
              </time>
            </Link>

            {additionalEvents.length > 0 ? (
              <div className="border-border border-t pt-3">
                <p className="type-supporting text-text-tertiary">
                  {t('customers.detail.additionalUpcoming', {
                    count: String(additionalEvents.length),
                  })}
                </p>
                <ul className="mt-2 space-y-1">
                  {additionalEvents.map((event) => {
                    const title = getEventTitle(event) ?? t('schedule.untitled');
                    return (
                      <li key={event.id}>
                        <Link
                          to={buildAppEventDetailPath(event.id)}
                          onClick={(clickEvent) => {
                            if (!onOpenEvent) return;
                            clickEvent.preventDefault();
                            onOpenEvent(event);
                          }}
                          aria-label={t('schedule.openEvent', { title })}
                          className="type-body text-brand-deep hover:bg-control rounded-control flex min-h-11 items-center justify-between gap-3 px-2 font-semibold underline-offset-2 hover:underline"
                        >
                          <span className="min-w-0 wrap-anywhere break-keep">{title}</span>
                          <time dateTime={event.scheduledAt} className="shrink-0 font-normal">
                            {formatAgendaDateTime(event.scheduledAt, locale)}
                          </time>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </>
        ) : ready ? (
          <p className="type-body text-text-secondary break-keep">
            {t('customers.detail.noUpcoming')}
          </p>
        ) : null}
        {action}
      </div>
    </section>
  );
}
