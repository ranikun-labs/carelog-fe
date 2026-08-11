import { cn } from '@/lib/utils';
import { formatAgendaWeekday, type WeekDay } from '@/components/schedule/agendaModel';
import { useTranslation } from '@/i18n/I18nContext';

interface WeekStripProps {
  days: readonly WeekDay[];
  selectedDateKey: string;
  eventDateKeys: ReadonlySet<string>;
  onSelect: (dateKey: string) => void;
}

export function WeekStrip({ days, selectedDateKey, eventDateKeys, onSelect }: WeekStripProps) {
  const { locale, t } = useTranslation();

  return (
    <nav
      aria-label={t('schedule.weekStripLabel')}
      data-week-strip
      className="bg-surface border-border-subtle sticky top-0 z-20 border-b px-3 py-2"
    >
      <ol className="grid grid-cols-7 gap-1">
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
                  'text-text-secondary relative flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-md px-1 text-xs transition-colors',
                  'focus-visible:outline-accent-primary focus-visible:outline-2 focus-visible:outline-offset-2',
                  active
                    ? 'bg-accent-primary-bg text-accent-primary-deep font-semibold'
                    : 'hover:bg-subtle',
                )}
              >
                <span className="text-text-tertiary text-[0.6875rem]">{weekday}</span>
                <span className="text-sm">{day.dayOfMonth}</span>
                <span aria-hidden="true" className="flex h-2 items-center justify-center gap-0.5">
                  {hasEvents ? (
                    <span data-event-dot className="bg-accent-primary h-1 w-1 rounded-full" />
                  ) : null}
                  {day.isToday ? (
                    <span
                      data-today-indicator
                      className="border-accent-primary h-1.5 w-1.5 rounded-full border"
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
