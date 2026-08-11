import { useNavigate, useParams } from 'react-router';

import { PageHeader } from '@/components/common/PageHeader';
import { EventDetail } from '@/components/schedule/EventDetail';
import { getEventTitle } from '@/components/schedule/agendaModel';
import { buildAppCustomerDetailPath, buildAppSchedulePath } from '@/constants/routes';
import { SCHEDULE_FIXTURE, type ScheduleCustomer } from '@/fixtures/schedule';
import { useTranslation } from '@/i18n/I18nContext';
import { AppNotFoundPage } from '@/pages/AppNotFoundPage';
import type { CustomerEvent } from '@/domain/customerEvent';

export interface EventDetailPageProps {
  events?: readonly CustomerEvent[];
  customers?: readonly ScheduleCustomer[];
  now?: Date;
}

export function EventDetailPage({
  events = SCHEDULE_FIXTURE.events,
  customers = SCHEDULE_FIXTURE.customers,
  now = new Date(),
}: EventDetailPageProps) {
  const { eventId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const event = events.find((candidate) => candidate.id === eventId);
  const customer = event
    ? customers.find((candidate) => candidate.id === event.customerId)
    : undefined;

  if (!event || !customer) return <AppNotFoundPage />;

  const title = getEventTitle(event) ?? t('schedule.untitled');
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={title}
        backLabel={t('eventDetail.back')}
        onBack={() => navigate(buildAppSchedulePath())}
      />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <EventDetail
          event={event}
          customerName={customer.displayName}
          customerPath={buildAppCustomerDetailPath(customer.id)}
          now={now}
        />
      </main>
    </div>
  );
}
