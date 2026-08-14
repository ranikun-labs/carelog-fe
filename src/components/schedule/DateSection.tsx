import {
  formatAgendaDate,
  getDateKeyFromDate,
  getCustomerName,
  type AgendaSection,
} from '@/components/schedule/agendaModel';
import type { ScheduleCustomer } from '@/types/customer';
import { AgendaRow } from '@/components/schedule/AgendaRow';
import { useTranslation } from '@/i18n/I18nContext';

interface DateSectionProps {
  section: AgendaSection;
  customers: readonly ScheduleCustomer[];
  now: Date;
  onOpen: (event: AgendaSection['events'][number]) => void;
  highlightedEventId?: string | null;
}

export function DateSection({
  section,
  customers,
  now,
  onOpen,
  highlightedEventId,
}: DateSectionProps) {
  const { locale, t } = useTranslation();
  const isToday = section.dateKey === getDateKeyFromDate(now);
  const headingId = `agenda-date-${section.dateKey}`;

  return (
    <section
      aria-labelledby={headingId}
      data-agenda-section
      data-date-key={section.dateKey}
      data-today-anchor={isToday ? true : undefined}
      className="scroll-mt-28"
    >
      <header className="bg-subtle border-border-subtle flex items-center justify-between border-y px-4 py-2">
        <h2 id={headingId} className="text-text-primary text-sm font-bold">
          {formatAgendaDate(section.dateKey, locale)}
          {isToday ? (
            <>
              {' '}
              <span className="text-accent-primary ml-2">{t('schedule.today')}</span>
            </>
          ) : null}
        </h2>
        {section.events.length === 0 ? (
          <span className="text-text-tertiary text-xs">{t('schedule.noEventsDate')}</span>
        ) : null}
      </header>

      {section.events.length > 0 ? (
        <ol>
          {section.events.map((event) => (
            <li key={event.id}>
              <AgendaRow
                event={event}
                customerName={
                  getCustomerName(customers, event.customerId) ?? t('schedule.unknownCustomer')
                }
                now={now}
                onOpen={onOpen}
                isHighlighted={event.id === highlightedEventId}
              />
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
