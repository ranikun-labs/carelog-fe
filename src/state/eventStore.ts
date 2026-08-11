import {
  cancelPlannedCustomerEvent,
  createOccurredCustomerEvent,
  createPlannedCustomerEvent,
  editCustomerEvent,
  occurPlannedCustomerEvent,
  type CustomerEvent,
  type CustomerEventEdit,
  type CreateOccurredCustomerEventInput,
  type CreatePlannedCustomerEventInput,
} from '@/domain/customerEvent';

export interface EventStoreState {
  events: readonly CustomerEvent[];
  highlightedEventId: string | null;
}

export type EventStoreAction =
  | { type: 'create'; event: CustomerEvent }
  | { type: 'replace'; event: CustomerEvent }
  | { type: 'highlight'; eventId: string }
  | { type: 'clear-highlight'; eventId?: string };

export function normalizeCustomerEvents(events: readonly CustomerEvent[]): CustomerEvent[] {
  const seenIds = new Set<string>();
  return events.filter((event) => {
    if (seenIds.has(event.id)) return false;
    seenIds.add(event.id);
    return true;
  });
}

export function createEventStoreState(events: readonly CustomerEvent[]): EventStoreState {
  return {
    events: normalizeCustomerEvents(events),
    highlightedEventId: null,
  };
}

export function eventStoreReducer(
  state: EventStoreState,
  action: EventStoreAction,
): EventStoreState {
  if (action.type === 'create') {
    if (state.events.some((event) => event.id === action.event.id)) return state;
    return { ...state, events: [...state.events, action.event] };
  }

  if (action.type === 'replace') {
    const eventIndex = state.events.findIndex((event) => event.id === action.event.id);
    if (eventIndex === -1) return state;

    const events = [...state.events];
    events[eventIndex] = action.event;
    return { ...state, events };
  }

  if (action.type === 'highlight') {
    return { ...state, highlightedEventId: action.eventId };
  }

  if (action.eventId === undefined || state.highlightedEventId === action.eventId) {
    return { ...state, highlightedEventId: null };
  }

  return state;
}

let generatedEventSequence = 0;

export function createCustomerEventId(
  existingEvents: readonly CustomerEvent[],
  timestamp = Date.now(),
): string {
  const existingIds = new Set(existingEvents.map((event) => event.id));
  while (true) {
    generatedEventSequence += 1;
    const candidate = `event-${timestamp.toString(36)}-${generatedEventSequence.toString(36)}`;
    if (!existingIds.has(candidate)) return candidate;
  }
}

export type EventCreationInput =
  | (CreatePlannedCustomerEventInput & { status: 'PLANNED' })
  | (CreateOccurredCustomerEventInput & { status: 'OCCURRED' });

export function buildCreatedCustomerEvent(id: string, input: EventCreationInput): CustomerEvent {
  return input.status === 'PLANNED'
    ? createPlannedCustomerEvent(id, input)
    : createOccurredCustomerEvent(id, input);
}

export function replaceEventById(
  events: readonly CustomerEvent[],
  event: CustomerEvent,
): CustomerEvent[] {
  return events.map((candidate) => (candidate.id === event.id ? event : candidate));
}

export function editEventById(
  events: readonly CustomerEvent[],
  eventId: string,
  changes: CustomerEventEdit,
): CustomerEvent | undefined {
  const current = events.find((event) => event.id === eventId);
  return current ? editCustomerEvent(current, changes) : undefined;
}

export function cancelEventById(
  events: readonly CustomerEvent[],
  eventId: string,
): CustomerEvent | undefined {
  const current = events.find((event) => event.id === eventId);
  return current?.status === 'PLANNED' ? cancelPlannedCustomerEvent(current) : undefined;
}

export function occurEventById(
  events: readonly CustomerEvent[],
  eventId: string,
  occurredAt: string,
): CustomerEvent | undefined {
  const current = events.find((event) => event.id === eventId);
  return current?.status === 'PLANNED' ? occurPlannedCustomerEvent(current, occurredAt) : undefined;
}
