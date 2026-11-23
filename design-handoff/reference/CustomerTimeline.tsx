import { useState } from 'react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/common/EmptyState';
import {
  CUSTOMER_HISTORY_INITIAL_LIMIT,
  CUSTOMER_HISTORY_PAGE_SIZE,
  getCustomerHistoryEvents,
} from '@/components/customers/customerDetailModel';
import {
  formatAgendaDateTime,
  getAgendaCoordinate,
  getEventTitle,
} from '@/components/schedule/agendaModel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { buildAppEventDetailPath } from '@/constants/routes';
import type { CustomerEvent } from '@/domain/customerEvent';
import { useTranslation } from '@/i18n/I18nContext';

interface CustomerTimelineProps {
  events: readonly CustomerEvent[];
  onOpenEvent?: (event: CustomerEvent) => void;
}

export function CustomerTimeline({ events, onOpenEvent }: CustomerTimelineProps) {
  const { locale, t } = useTranslation();
  const [visibleCount, setVisibleCount] = useState(CUSTOMER_HISTORY_INITIAL_LIMIT);
  const ordered = getCustomerHistoryEvents(events);
  const visibleEvents = ordered.slice(0, visibleCount);

  return (
    <section className="mt-6" data-customer-history aria-labelledby="customer-history-title">
      <h2 id="customer-history-title" className="text-lg font-semibold">
        {t('timeline.title')}
      </h2>
      {ordered.length === 0 ? (
        <EmptyState title={t('timeline.title')} description={t('timeline.empty')} />
      ) : (
        <>
          <ol className="mt-3 space-y-2">
            {visibleEvents.map((event) => {
              const title = getEventTitle(event) ?? t('schedule.untitled');
              const coordinate = getAgendaCoordinate(event);
              const isCancelled = event.status === 'CANCELLED';

              return (
                <li
                  key={event.id}
                  data-customer-history-item
                  data-event-id={event.id}
                  data-event-status={event.status}
                >
                  <Link
                    to={buildAppEventDetailPath(event.id)}
                    onClick={(clickEvent) => {
                      if (!onOpenEvent) return;
                      clickEvent.preventDefault();
                      onOpenEvent(event);
                    }}
                    aria-label={t('schedule.openEvent', { title })}
                    className="border-border-subtle hover:bg-subtle block rounded-md border p-3 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-text-primary min-w-0 flex-1 truncate font-medium">
                        {title}
                      </p>
                      {isCancelled ? (
                        <Badge tone="cancelled">{t('eventDetail.statusCancelled')}</Badge>
                      ) : (
                        <span className="text-status-neutral-foreground shrink-0 text-xs font-semibold">
                          {t('schedule.meta.occurred')}
                        </span>
                      )}
                    </div>
                    <time dateTime={coordinate} className="text-text-tertiary mt-1 block text-sm">
                      {formatAgendaDateTime(coordinate, locale)}
                    </time>
                  </Link>
                </li>
              );
            })}
          </ol>
          {visibleEvents.length < ordered.length ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              data-history-load-more
              onClick={() => setVisibleCount((count) => count + CUSTOMER_HISTORY_PAGE_SIZE)}
            >
              {t('timeline.loadMore')}
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}
