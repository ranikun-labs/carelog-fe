import { Link } from 'react-router';

import { getEventTitle, formatAgendaDateTime } from '@/components/schedule/agendaModel';
import { getUpcomingCustomerEvents } from '@/components/customers/customerDetailModel';
import { Badge } from '@/components/ui/badge';
import { buildAppEventDetailPath } from '@/constants/routes';
import type { CustomerEvent } from '@/domain/customerEvent';
import { useTranslation } from '@/i18n/I18nContext';

interface CustomerUpcomingProps {
  events: readonly CustomerEvent[];
  now: Date;
}

export function CustomerUpcoming({ events, now }: CustomerUpcomingProps) {
  const { locale, t } = useTranslation();
  const upcomingEvents = getUpcomingCustomerEvents(events, now);
  const [primaryEvent, ...additionalEvents] = upcomingEvents;

  return (
    <section className="mt-6" data-customer-upcoming aria-labelledby="customer-upcoming-title">
      <h2 id="customer-upcoming-title" className="text-lg font-semibold">
        {t('customers.detail.upcomingTitle')}
      </h2>

      {primaryEvent ? (
        <div className="mt-3 space-y-3">
          <Link
            to={buildAppEventDetailPath(primaryEvent.id)}
            aria-label={t('schedule.openEvent', {
              title: getEventTitle(primaryEvent) ?? t('schedule.untitled'),
            })}
            data-upcoming-primary
            className="bg-subtle border-border-default hover:bg-accent-primary-bg/60 block rounded-lg border p-4 transition-colors"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="text-text-primary min-w-0 flex-1 truncate text-base font-semibold">
                {getEventTitle(primaryEvent) ?? t('schedule.untitled')}
              </h3>
              <Badge tone="planned">{t('schedule.meta.planned')}</Badge>
            </div>
            <time
              dateTime={primaryEvent.scheduledAt}
              className="text-text-secondary mt-2 block text-sm"
            >
              {formatAgendaDateTime(primaryEvent.scheduledAt, locale)}
            </time>
          </Link>

          {additionalEvents.length > 0 ? (
            <div className="border-border-subtle border-t pt-3">
              <p className="text-text-tertiary text-sm">
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
                        aria-label={t('schedule.openEvent', { title })}
                        className="text-accent-primary-deep hover:bg-subtle flex min-h-11 items-center justify-between gap-3 rounded-md px-2 text-sm font-semibold underline-offset-2 hover:underline"
                      >
                        <span className="min-w-0 truncate">{title}</span>
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
        </div>
      ) : (
        <div
          data-customer-upcoming-empty
          className="bg-subtle border-border-default mt-3 rounded-lg border p-4"
        >
          <p className="text-text-secondary text-sm">{t('customers.detail.noUpcoming')}</p>
        </div>
      )}
    </section>
  );
}
