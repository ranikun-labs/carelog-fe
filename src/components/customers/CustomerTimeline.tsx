import { EmptyState } from '@/components/common/EmptyState';
import {
  isOccurredCustomerEvent,
  type CustomerEvent,
  type OccurredCustomerEvent,
} from '@/domain/customerEvent';
import { useTranslation } from '@/i18n/I18nContext';
import { formatDate } from '@/lib/utils';

interface CustomerTimelineProps {
  events: readonly CustomerEvent[];
}

function compareTimelineEntriesByInstant(
  a: OccurredCustomerEvent,
  b: OccurredCustomerEvent,
): number {
  const aInstant = Date.parse(a.occurredAt);
  const bInstant = Date.parse(b.occurredAt);
  const aIsInvalid = Number.isNaN(aInstant);
  const bIsInvalid = Number.isNaN(bInstant);

  if (aIsInvalid || bIsInvalid) {
    if (aIsInvalid && bIsInvalid) {
      return 0;
    }
    return aIsInvalid ? 1 : -1;
  }

  return bInstant - aInstant;
}

export function CustomerTimeline({ events }: CustomerTimelineProps) {
  const { t } = useTranslation();
  const ordered = events.filter(isOccurredCustomerEvent).sort(compareTimelineEntriesByInstant);

  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">{t('timeline.title')}</h2>
      {ordered.length === 0 ? (
        <EmptyState title={t('timeline.title')} description={t('timeline.empty')} />
      ) : (
        <ol className="mt-3 space-y-3">
          {ordered.map((entry) => (
            <li key={entry.id} className="border-border border-l-2 pl-3">
              {entry.descriptor ? <p className="font-medium">{entry.descriptor}</p> : null}
              <time dateTime={entry.occurredAt} className="text-text-tertiary text-sm">
                {formatDate(entry.occurredAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
