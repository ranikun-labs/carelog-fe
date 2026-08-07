import { EmptyState } from '@/components/common/EmptyState';
import { useTranslation } from '@/i18n/I18nContext';
import { formatDate } from '@/lib/utils';
import type { TimelineEntry } from '@/types/customer';

interface CustomerTimelineProps {
  entries: readonly TimelineEntry[];
}

function compareTimelineEntriesByInstant(a: TimelineEntry, b: TimelineEntry): number {
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

export function CustomerTimeline({ entries }: CustomerTimelineProps) {
  const { t } = useTranslation();
  const ordered = [...entries].sort(compareTimelineEntriesByInstant);

  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">{t('timeline.title')}</h2>
      {ordered.length === 0 ? (
        <EmptyState title={t('timeline.title')} description={t('timeline.empty')} />
      ) : (
        <ol className="mt-3 space-y-3">
          {ordered.map((entry) => (
            <li key={entry.id} className="border-border border-l-2 pl-3">
              <p className="font-medium">{entry.label}</p>
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
