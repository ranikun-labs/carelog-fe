import { useLocation, useNavigate } from 'react-router';

import { useOptionalAssistantAdapter } from '@/assistant/AssistantAdapterContext';
import { getAssistantContextKey, resolveAssistantContext } from '@/assistant/assistantTypes';
import { AssistantSurface } from '@/components/assistant/AssistantSurface';
import { buildAppCustomerDetailPath, buildAppEventDetailPath } from '@/constants/routes';
import { SCHEDULE_FIXTURE } from '@/fixtures/schedule';
import { AppNotFoundPage } from '@/pages/AppNotFoundPage';
import { useCustomerStore } from '@/state/CustomerStoreContext';
import { useOptionalEventStore } from '@/state/EventStoreContext';
import {
  readAdaptiveNavigationState,
  useOptionalAdaptiveHost,
} from '@/components/layout/adaptiveHostContext';

export function AssistantPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const adaptiveHost = useOptionalAdaptiveHost();
  const customerStore = useCustomerStore();
  const eventStore = useOptionalEventStore();
  const adapter = useOptionalAssistantAdapter();
  const navigation = readAdaptiveNavigationState(location.state).assistant;
  const events = eventStore?.events ?? SCHEDULE_FIXTURE.events;
  const resolvedContext = navigation
    ? resolveAssistantContext(navigation, customerStore.customers, events)
    : undefined;

  if (!resolvedContext || !navigation) return <AppNotFoundPage />;
  const currentNavigation = navigation;
  const currentContext = resolvedContext;

  function goBack() {
    if (adaptiveHost) {
      adaptiveHost.goBackFromAssistant();
      return;
    }

    const adaptiveState = readAdaptiveNavigationState(location.state);
    if (currentNavigation.returnTo.kind === 'customer-detail') {
      navigate(buildAppCustomerDetailPath(currentNavigation.returnTo.customerId), {
        state: {
          adaptiveRoot: 'customers',
          adaptiveCustomerId: currentNavigation.returnTo.customerId,
        },
      });
      return;
    }

    navigate(buildAppEventDetailPath(currentNavigation.returnTo.eventId), {
      state: {
        adaptiveRoot: adaptiveState.adaptiveRoot ?? 'schedule',
        adaptiveCustomerId: currentNavigation.returnTo.customerId,
        adaptiveEventId: currentNavigation.returnTo.eventId,
      },
    });
  }

  function saveCustomerMemo(memo: string) {
    const currentCustomer = customerStore.getCustomer(currentContext.customer.id);
    if (!currentCustomer) return undefined;
    return customerStore.editCustomer(currentCustomer.id, {
      displayName: currentCustomer.displayName,
      customerMemo: memo,
    });
  }

  function saveEventMemo(memo: string) {
    if (!eventStore || !currentContext.event) return undefined;
    const currentEvent = eventStore.events.find((event) => event.id === currentContext.event?.id);
    if (!currentEvent) return undefined;
    return eventStore.editEvent(currentEvent.id, { note: memo });
  }

  return (
    <AssistantSurface
      key={getAssistantContextKey(currentNavigation.context)}
      context={currentContext}
      adapter={adapter}
      onBack={goBack}
      onSaveCustomerMemo={
        currentNavigation.context.kind === 'customer' ? saveCustomerMemo : undefined
      }
      onSaveEventMemo={currentNavigation.context.kind === 'customer' ? undefined : saveEventMemo}
    />
  );
}
