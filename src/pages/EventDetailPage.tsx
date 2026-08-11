import { useNavigate, useParams } from 'react-router';

import { PageHeader } from '@/components/common/PageHeader';
import { EventDetail } from '@/components/schedule/EventDetail';
import { getAgendaDateKey, getEventTitle } from '@/components/schedule/agendaModel';
import {
  toCanonicalTimestamp,
  toDateTimeLocalValue,
  type EventFormSubmitValues,
} from '@/components/schedule/EventForm';
import { buildAppCustomerDetailPath, buildAppSchedulePath } from '@/constants/routes';
import type { CustomerEvent, CustomerEventEdit } from '@/domain/customerEvent';
import { SCHEDULE_FIXTURE, type ScheduleCustomer } from '@/fixtures/schedule';
import { useTranslation } from '@/i18n/I18nContext';
import { AppNotFoundPage } from '@/pages/AppNotFoundPage';
import { useOptionalEventStore } from '@/state/EventStoreContext';

export interface EventDetailPageProps {
  events?: readonly CustomerEvent[];
  customers?: readonly ScheduleCustomer[];
  now?: Date;
  onEditEvent?: (eventId: string, changes: CustomerEventEdit) => CustomerEvent | undefined;
  onCancelEvent?: (eventId: string) => CustomerEvent | undefined;
  onOccurEvent?: (eventId: string, occurredAt: string) => CustomerEvent | undefined;
}

export function EventDetailPage({
  events = SCHEDULE_FIXTURE.events,
  customers = SCHEDULE_FIXTURE.customers,
  now = new Date(),
  onEditEvent,
  onCancelEvent,
  onOccurEvent,
}: EventDetailPageProps) {
  const { eventId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const eventStore = useOptionalEventStore();
  const sourceEvents =
    eventStore && events === SCHEDULE_FIXTURE.events ? eventStore.events : events;
  const event = sourceEvents.find((candidate) => candidate.id === eventId);
  const customer = event
    ? customers.find((candidate) => candidate.id === event.customerId)
    : undefined;

  if (!event || !customer) return <AppNotFoundPage />;

  const currentEvent = event;
  const currentCustomer = customer;

  const title = getEventTitle(currentEvent) ?? t('schedule.untitled');
  const editEvent = onEditEvent ?? (eventStore ? eventStore.editEvent : undefined);
  const cancelEvent = onCancelEvent ?? (eventStore ? eventStore.cancelEvent : undefined);
  const occurEvent = onOccurEvent ?? (eventStore ? eventStore.occurEvent : undefined);

  function returnToAgenda(updatedEvent: CustomerEvent) {
    navigate(buildAppSchedulePath(), {
      state: {
        targetEventId: updatedEvent.id,
        targetDateKey: getAgendaDateKey(updatedEvent),
      },
    });
  }

  function handleEdit(values: EventFormSubmitValues): CustomerEvent | undefined {
    if (!editEvent) return undefined;
    const changes: CustomerEventEdit = {
      descriptor: values.descriptor,
      note: values.note,
      ...(values.scheduledAt ? { scheduledAt: values.scheduledAt } : {}),
      ...(values.occurredAt ? { occurredAt: values.occurredAt } : {}),
    };
    const updatedEvent = editEvent(currentEvent.id, changes);
    if (updatedEvent) returnToAgenda(updatedEvent);
    return updatedEvent;
  }

  function handleCancel(): CustomerEvent | undefined {
    if (!cancelEvent) return undefined;
    const updatedEvent = cancelEvent(currentEvent.id);
    if (updatedEvent) returnToAgenda(updatedEvent);
    return updatedEvent;
  }

  function handleOccur(): CustomerEvent | undefined {
    if (!occurEvent) return undefined;
    const updatedEvent = occurEvent(
      currentEvent.id,
      toCanonicalTimestamp(toDateTimeLocalValue(now.toISOString())),
    );
    if (updatedEvent) returnToAgenda(updatedEvent);
    return updatedEvent;
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={title}
        backLabel={t('eventDetail.back')}
        onBack={() => navigate(buildAppSchedulePath())}
      />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <EventDetail
          event={currentEvent}
          customerName={currentCustomer.displayName}
          customerPath={buildAppCustomerDetailPath(currentCustomer.id)}
          now={now}
          onEdit={editEvent && currentEvent.status !== 'CANCELLED' ? handleEdit : undefined}
          onCancelEvent={
            cancelEvent && currentEvent.status === 'PLANNED' ? handleCancel : undefined
          }
          onOccurEvent={occurEvent && currentEvent.status === 'PLANNED' ? handleOccur : undefined}
        />
      </main>
    </div>
  );
}
