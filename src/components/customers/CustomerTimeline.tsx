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
    <section className="mt-8" data-customer-history aria-labelledby="customer-history-title">
      <h2 id="customer-history-title" className="type-section-title text-foreground break-keep">
        {t('timeline.title')}
      </h2>
      {ordered.length === 0 ? (
        <EmptyState title={t('timeline.title')} description={t('timeline.empty')} />
      ) : (
        <>
          <ol className="border-border mt-2 border-t">
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
                    className="border-border hover:bg-inset block min-h-11 border-b px-1 py-3 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="type-content-title text-foreground min-w-0 flex-1 wrap-anywhere break-keep">
                        {title}
                      </p>
                      {isCancelled ? (
                        <Badge tone="cancelled">{t('eventDetail.statusCancelled')}</Badge>
                      ) : (
                        <span className="type-label text-text-secondary shrink-0">
                          {t('schedule.meta.occurred')}
                        </span>
                      )}
                    </div>
                    <time
                      dateTime={coordinate}
                      className="type-supporting text-text-tertiary mt-1 block"
                    >
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
              variant="neutral"
              className="mt-4 w-full"
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
