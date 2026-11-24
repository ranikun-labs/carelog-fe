import { cn } from '@/lib/utils';
import { formatAgendaWeekday, type WeekDay } from '@/components/schedule/agendaModel';
import { useTranslation } from '@/i18n/I18nContext';

interface WeekStripProps {
  days: readonly WeekDay[];
  selectedDateKey: string;
  eventDateKeys: ReadonlySet<string>;
  onSelect: (dateKey: string) => void;
}

/**
 * 주간 띠. 페이지 면(page) 위에 가장자리까지 펼쳐 7칸이 좌우 여백 없이 나눠 갖는다 —
 * 320 폭에서도 칸 너비가 44 이상(7칸 × 45.7)이 되게 하려는 것이다. 칸 사이 gap·좌우 padding을 두지 않는다.
 * 요일 글자는 12px(type-label) 하한을 지킨다. 선택 칸은 brand-subtle 면 + deep 글자 + aria-current/pressed.
 */
export function WeekStrip({ days, selectedDateKey, eventDateKeys, onSelect }: WeekStripProps) {
  const { locale, t } = useTranslation();

  return (
    <nav
      aria-label={t('schedule.weekStripLabel')}
      data-week-strip
      className="bg-surface sticky top-0 z-20 py-2"
    >
      <ol className="grid grid-cols-7">
        {days.map((day) => {
          const active = day.dateKey === selectedDateKey;
          const hasEvents = eventDateKeys.has(day.dateKey);
          const weekday = formatAgendaWeekday(day.dateKey, locale);
          return (
            <li key={day.dateKey}>
              <button
                type="button"
                data-date-key={day.dateKey}
                aria-current={active ? 'date' : undefined}
                aria-pressed={active}
                aria-label={`${weekday} ${day.dayOfMonth}${day.isToday ? `, ${t('schedule.today')}` : ''}${hasEvents ? `, ${t('schedule.hasEvents')}` : ''}`}
                onClick={() => onSelect(day.dateKey)}
                className={cn(
                  'rounded-control relative flex min-h-14 w-full min-w-11 flex-col items-center justify-center gap-0.5 px-1 transition-colors',
                  active ? 'bg-brand-subtle text-brand-deep' : 'text-foreground hover:bg-inset',
                )}
              >
                <span
                  className={cn(
                    'type-label font-semibold',
                    active ? 'text-brand-deep' : 'text-text-tertiary',
                  )}
                >
                  {weekday}
                </span>
                <span className="type-content-title font-semibold">{day.dayOfMonth}</span>
                <span aria-hidden="true" className="flex h-2 items-center justify-center gap-0.5">
                  {hasEvents ? (
                    <span data-event-dot className="bg-primary h-1 w-1 rounded-full" />
                  ) : null}
                  {day.isToday ? (
                    <span
                      data-today-indicator
                      className="border-primary h-1.5 w-1.5 rounded-full border"
                    />
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
