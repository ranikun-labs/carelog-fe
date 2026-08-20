import { useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';

import {
  AdaptiveSurface,
  AdaptiveSurfaceContent,
  useOptionalAdaptiveHost,
} from '@/components/layout/adaptiveHostContext';
import { PageHeader } from '@/components/common/PageHeader';
import { EventDetail } from '@/components/schedule/EventDetail';
import { getAgendaDateKey, getEventTitle } from '@/components/schedule/agendaModel';
import type { EventFormSubmitValues } from '@/components/schedule/EventForm';
import {
  buildAppAssistantPath,
  buildAppCustomerDetailPath,
  buildAppSchedulePath,
} from '@/constants/routes';
import type { AssistantNavigationState } from '@/assistant/assistantTypes';
import type { CustomerEvent, CustomerEventEdit } from '@/domain/customerEvent';
import { getCarelogMessageKey } from '@/integrations/carelog/errorMapping';
import { useTranslation } from '@/i18n/I18nContext';
import { AppNotFoundPage } from '@/pages/AppNotFoundPage';
import { useCustomerStore } from '@/state/CustomerStoreContext';
import { useOptionalEventStore } from '@/state/EventStoreContext';
import type { ScheduleCustomer } from '@/types/customer';

export interface EventDetailPageProps {
  eventId?: string;
  events?: readonly CustomerEvent[];
  customers?: readonly ScheduleCustomer[];
  now?: Date;
  onEditEvent?: (
    eventId: string,
    changes: CustomerEventEdit,
  ) => CustomerEvent | undefined | Promise<CustomerEvent>;
  onCancelEvent?: (eventId: string) => CustomerEvent | undefined | Promise<CustomerEvent>;
  onOccurEvent?: (
    eventId: string,
    occurredAt: string,
  ) => CustomerEvent | undefined | Promise<CustomerEvent>;
}

export function EventDetailPage({
  eventId: eventIdProp,
  events,
  customers,
  now = new Date(),
  onEditEvent,
  onCancelEvent,
  onOccurEvent,
}: EventDetailPageProps) {
  const { eventId: routeEventId = '' } = useParams();
  const eventId = eventIdProp ?? routeEventId;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const adaptiveHost = useOptionalAdaptiveHost();
  const customerStore = useCustomerStore();
  const eventStore = useOptionalEventStore();
  const loadEvent = eventStore?.loadEvent;
  const remoteReadsEnabled = eventStore?.remoteReadsEnabled ?? false;
  const loadCustomer = customerStore.loadCustomer;
  const scrollSurfaceRef = useRef<HTMLDivElement>(null);
  const sourceEvents = events ?? eventStore?.events ?? [];
  const sourceCustomers =
    customers ?? customerStore.customers.map(({ id, displayName }) => ({ id, displayName }));
  const event = sourceEvents.find((candidate) => candidate.id === eventId);
  const customer = event
    ? sourceCustomers.find((candidate) => candidate.id === event.customerId)
    : undefined;

  useEffect(() => {
    if (!remoteReadsEnabled || !loadEvent || events !== undefined || event || !eventId) return;
    void loadEvent(eventId).catch(() => undefined);
  }, [event, eventId, events, loadEvent, remoteReadsEnabled]);

  useEffect(() => {
    if (customer || !customerStore.remoteReadsEnabled || !event) return;
    if (customerStore.detailLoadState !== 'idle') return;
    void loadCustomer(event.customerId).catch(() => undefined);
  }, [
    customer,
    customerStore.detailLoadState,
    customerStore.remoteReadsEnabled,
    event,
    loadCustomer,
  ]);

  useLayoutEffect(() => {
    const scrollSurface = scrollSurfaceRef.current;
    if (!scrollSurface || !adaptiveHost) return;
    scrollSurface.scrollTop = adaptiveHost.eventDetailScrollTop;
  }, [adaptiveHost]);

  useEffect(() => {
    const scrollSurface = scrollSurfaceRef.current;
    if (!scrollSurface) return;
    const updateScrollPosition = () => {
      adaptiveHost?.setEventDetailScrollTop(scrollSurface.scrollTop);
    };
    scrollSurface.addEventListener('scroll', updateScrollPosition, { passive: true });
    return () => scrollSurface.removeEventListener('scroll', updateScrollPosition);
  }, [adaptiveHost]);

  if (!event || !customer) {
    if (eventStore?.remoteReadsEnabled && eventStore.error) {
      return (
        <div role="alert" className="p-6">
          {t(getCarelogMessageKey(eventStore.error))}
        </div>
      );
    }
    if (customerStore.remoteReadsEnabled && customerStore.error) {
      return (
        <div role="alert" className="p-6">
          {t(getCarelogMessageKey(customerStore.error))}
        </div>
      );
    }
    if (eventStore?.remoteReadsEnabled && eventStore.scheduleLoadState !== 'error') {
      return (
        <div role="status" aria-busy="true" className="p-6">
          {t('schedule.loadingLabel')}
        </div>
      );
    }
    return <AppNotFoundPage />;
  }

  const currentEvent = event;
  const currentCustomer = customer;

  const title = getEventTitle(currentEvent) ?? t('schedule.untitled');
  const editEvent = onEditEvent ?? (eventStore ? eventStore.editEvent : undefined);
  const cancelEvent = onCancelEvent ?? (eventStore ? eventStore.cancelEvent : undefined);
  const occurEvent = onOccurEvent ?? (eventStore ? eventStore.occurEvent : undefined);

  function returnToAgenda(updatedEvent: CustomerEvent) {
    if (adaptiveHost) {
      adaptiveHost.returnFromEvent(
        updatedEvent.id,
        currentCustomer.id,
        getAgendaDateKey(updatedEvent),
      );
      return;
    }
    navigate(buildAppSchedulePath(), {
      state: {
        targetEventId: updatedEvent.id,
        targetDateKey: getAgendaDateKey(updatedEvent),
      },
    });
  }

  async function handleEdit(values: EventFormSubmitValues): Promise<CustomerEvent | undefined> {
    if (!editEvent) return undefined;
    const changes: CustomerEventEdit = {
      descriptor: values.descriptor,
      note: values.note,
      ...(values.scheduledAt ? { scheduledAt: values.scheduledAt } : {}),
      ...(values.occurredAt ? { occurredAt: values.occurredAt } : {}),
    };
    const updatedEvent = await editEvent(currentEvent.id, changes);
    if (updatedEvent) returnToAgenda(updatedEvent);
    return updatedEvent;
  }

  async function handleCancel(): Promise<CustomerEvent | undefined> {
    if (!cancelEvent) return undefined;
    const updatedEvent = await cancelEvent(currentEvent.id);
    if (updatedEvent) returnToAgenda(updatedEvent);
    return updatedEvent;
  }

  async function handleOccur(occurredAt: string): Promise<CustomerEvent | undefined> {
    if (!occurEvent) return undefined;
    const updatedEvent = await occurEvent(currentEvent.id, occurredAt);
    if (updatedEvent) returnToAgenda(updatedEvent);
    return updatedEvent;
  }

  function openAssistant() {
    if (currentEvent.status === 'CANCELLED') return;
    const assistantNavigation: AssistantNavigationState = {
      context: {
        kind: currentEvent.status === 'PLANNED' ? 'planned-event' : 'occurred-event',
        customerId: currentCustomer.id,
        eventId: currentEvent.id,
      },
      returnTo: {
        kind: 'event-detail',
        customerId: currentCustomer.id,
        eventId: currentEvent.id,
      },
    };

    if (adaptiveHost) {
      adaptiveHost.openAssistant(assistantNavigation);
      return;
    }
    navigate(buildAppAssistantPath(), {
      state: {
        adaptiveRoot: 'schedule',
        adaptiveCustomerId: currentCustomer.id,
        adaptiveEventId: currentEvent.id,
        assistant: assistantNavigation,
      },
    });
  }

  return (
    <AdaptiveSurface
      majorSurface="event-detail"
      data-event-detail-page
      data-selected-event-id={currentEvent.id}
      className="flex h-full flex-col"
    >
      <PageHeader
        title={title}
        backLabel={t('eventDetail.back')}
        onBack={() =>
          adaptiveHost
            ? adaptiveHost.goBackFromEvent(currentCustomer.id)
            : navigate(buildAppSchedulePath())
        }
      />
      <div
        ref={scrollSurfaceRef}
        data-scroll-surface
        data-root-scroll-surface="event-detail"
        className="flex-1 overflow-y-auto p-4 md:p-6"
      >
        <AdaptiveSurfaceContent policy="readable">
          <EventDetail
            event={currentEvent}
            customerName={currentCustomer.displayName}
            customerPath={buildAppCustomerDetailPath(currentCustomer.id)}
            now={now}
            onOpenAssistant={currentEvent.status === 'CANCELLED' ? undefined : openAssistant}
            onOpenCustomer={
              adaptiveHost
                ? () => adaptiveHost.openCustomerFromEvent(currentCustomer.id)
                : undefined
            }
            onEdit={editEvent && currentEvent.status !== 'CANCELLED' ? handleEdit : undefined}
            onCancelEvent={
              cancelEvent && currentEvent.status === 'PLANNED' ? handleCancel : undefined
            }
            onOccurEvent={occurEvent && currentEvent.status === 'PLANNED' ? handleOccur : undefined}
          />
        </AdaptiveSurfaceContent>
      </div>
    </AdaptiveSurface>
  );
}
