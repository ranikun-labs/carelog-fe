import { ChevronRight } from 'lucide-react';

import { formatOverdueCount } from '@/components/schedule/agendaModel';
import { useTranslation } from '@/i18n/I18nContext';

interface OverdueCueProps {
  count: number;
  onSelect: () => void;
}

/**
 * 정리 필요 안내. 주간 띠 아래 warning Notice 한 장 — 누르면 가장 최근 지난 일정으로 간다.
 * 문장에 건수가 이미 들어 있어 건수 배지는 중복이라 두지 않는다(상태는 글자 + 아이콘으로 전달).
 */
export function OverdueCue({ count, onSelect }: OverdueCueProps) {
  const { t } = useTranslation();
  if (count === 0) return null;

  const label = t('schedule.overdueCueLabel', { count: formatOverdueCount(count) });
  return (
    <section data-overdue-cue className="px-4 pt-2 md:px-6">
      <button
        type="button"
        aria-label={label}
        onClick={onSelect}
        className="bg-warning-bg text-warning rounded-inset type-label flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left transition-colors hover:brightness-95"
      >
        <span className="break-keep">{label}</span>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
      </button>
    </section>
  );
}
