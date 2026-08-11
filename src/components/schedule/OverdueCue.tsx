import { Badge } from '@/components/ui/badge';
import { formatOverdueCount } from '@/components/schedule/agendaModel';
import { useTranslation } from '@/i18n/I18nContext';

interface OverdueCueProps {
  count: number;
  onSelect: () => void;
}

export function OverdueCue({ count, onSelect }: OverdueCueProps) {
  const { t } = useTranslation();
  if (count === 0) return null;

  const displayCount = formatOverdueCount(count);
  return (
    <section data-overdue-cue className="px-4 pt-4">
      <button
        type="button"
        aria-label={t('schedule.overdueCueLabel', { count: displayCount })}
        onClick={onSelect}
        className="bg-warning-bg text-warning focus-visible:outline-accent-primary flex min-h-11 w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span>{t('schedule.overdueCueLabel', { count: displayCount })}</span>
        <Badge tone="overdue">{displayCount}</Badge>
      </button>
    </section>
  );
}
