import { useEffect, useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';

import {
  AdaptiveSurface,
  AdaptiveSurfaceContent,
  readAdaptiveNavigationState,
  useOptionalAdaptiveHost,
} from '@/components/layout/adaptiveHostContext';
import { PageHeader } from '@/components/common/PageHeader';
import { ErrorState } from '@/components/ui/error-state';
import { EventDetail } from '@/components/schedule/EventDetail';
import { getAgendaDateKey, getEventTitle } from '@/components/schedule/agendaModel';
import type {
  EventFormSubmitOptions,
  EventFormSubmitValues,
} from '@/components/schedule/EventForm';
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
import { useOptionalSaveSession } from '@/state/saveSessionContext';
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
  const location = useLocation();
  const startWithOccurrenceConfirmation = readAdaptiveNavigationState(
    location.state,
  ).openOccurrence;
  const adaptiveHost = useOptionalAdaptiveHost();
  const customerStore = useCustomerStore();
  const eventStore = useOptionalEventStore();
  const loadEvent = eventStore?.loadEvent;
  const remoteReadsEnabled = eventStore?.remoteReadsEnabled ?? false;
  const loadCustomer = customerStore.loadCustomer;
  const scrollSurfaceRef = useRef<HTMLDivElement>(null);
  // 저장 응답이 떠난 뒤 도착할 수 있다(handleEdit 참고). 훅은 early return보다 앞에 둔다.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  // 저장 세션: 지금 보이는 일정 대상을 등록한다. 다른 일정으로 바뀌면 이전 일정의 응답은 소유권을 잃는다.
  const saveSession = useOptionalSaveSession();
  const setSaveActive = saveSession?.setActive;
  const editSaveKey = `event:${eventId}`;
  useEffect(() => {
    if (!setSaveActive) return;
    setSaveActive(editSaveKey, true);
    return () => setSaveActive(editSaveKey, false);
  }, [editSaveKey, setSaveActive]);
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
    const failure =
      eventStore?.remoteReadsEnabled && eventStore.error
        ? eventStore.error
        : customerStore.remoteReadsEnabled && customerStore.error
          ? customerStore.error
          : undefined;
    if (failure) {
      return <ErrorState className="p-6" title={t(getCarelogMessageKey(failure))} />;
    }
    if (eventStore?.remoteReadsEnabled && eventStore.scheduleLoadState !== 'error') {
      return (
        <div role="status" aria-busy="true" className="type-body text-text-secondary p-6">
          {t('schedule.loadingLabel')}
        </div>
      );
    }
    return <AppNotFoundPage />;
  }

  // 저장 응답이 떠난 뒤 도착할 수 있다(handleEdit 참고). 훅은 early return보다 앞에 둔다.
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

  async function handleEdit(
    values: EventFormSubmitValues,
    options?: EventFormSubmitOptions,
  ): Promise<CustomerEvent | undefined> {
    if (!editEvent) return undefined;
    const changes: CustomerEventEdit = {
      descriptor: values.descriptor,
      note: values.note,
      ...(values.scheduledAt ? { scheduledAt: values.scheduledAt } : {}),
      ...(values.occurredAt ? { occurredAt: values.occurredAt } : {}),
    };
    const updatedEvent = await editEvent(currentEvent.id, changes);
    // 저장 응답이 떠난 뒤 도착하거나 다른 일정 대상이 된 뒤 도착하면 일정 화면으로 되돌리지 않는다.
    const current = options?.isCurrent ? options.isCurrent() : mountedRef.current;
    if (!current) return updatedEvent;
    // 저장 성공을 확인한 뒤 화면을 옮기므로 이탈 보호를 먼저 놓는다.
    options?.allowLeave();
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
            // 다른 일정이 되면 편집창·입력을 새로 만든다(이전 일정의 편집 상태가 넘어가지 않게).
            key={currentEvent.id}
            event={currentEvent}
            customerName={currentCustomer.displayName}
            customerPath={buildAppCustomerDetailPath(currentCustomer.id)}
            now={now}
            startWithOccurrenceConfirmation={startWithOccurrenceConfirmation}
            saveKey={editSaveKey}
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
