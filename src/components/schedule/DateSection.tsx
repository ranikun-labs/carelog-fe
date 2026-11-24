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

/**
 * 날짜별 섹션. 날짜 머리는 카드 밖 section-title, 그날의 일정은 카드 1장 안 행으로 묶는다.
 * 셸 바탕이 surface(흰색)라 카드는 inset 면(회색)으로 구분한다 — 테두리·그림자 없이 행 사이는 hairline만 쓴다.
 * 오늘 표식은 글자(오늘)로 남긴다.
 */
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
      <header className="flex min-h-9 items-baseline justify-between gap-3 px-1 pb-2">
        <h2 id={headingId} className="type-section-title text-foreground break-keep">
          {formatAgendaDate(section.dateKey, locale)}
          {isToday ? (
            <>
              {' '}
              <span className="type-label text-brand-deep ml-2">{t('schedule.today')}</span>
            </>
          ) : null}
        </h2>
        {section.events.length === 0 ? (
          <span className="type-meta text-text-tertiary">{t('schedule.noEventsDate')}</span>
        ) : null}
      </header>

      {section.events.length > 0 ? (
        <ol className="bg-inset rounded-card divide-card divide-y p-1">
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
