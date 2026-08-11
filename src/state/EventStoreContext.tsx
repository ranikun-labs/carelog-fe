/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useReducer, type ReactNode } from 'react';

import type { CustomerEvent, CustomerEventEdit } from '@/domain/customerEvent';
import { SCHEDULE_FIXTURE } from '@/fixtures/schedule';
import {
  buildCreatedCustomerEvent,
  cancelEventById,
  createCustomerEventId,
  createEventStoreState,
  editEventById,
  eventStoreReducer,
  occurEventById,
  type EventCreationInput,
} from '@/state/eventStore';

export interface EventStoreValue {
  events: readonly CustomerEvent[];
  highlightedEventId: string | null;
  createEvent: (input: EventCreationInput) => CustomerEvent;
  editEvent: (eventId: string, changes: CustomerEventEdit) => CustomerEvent | undefined;
  cancelEvent: (eventId: string) => CustomerEvent | undefined;
  occurEvent: (eventId: string, occurredAt: string) => CustomerEvent | undefined;
  clearHighlight: (eventId?: string) => void;
}

const EventStoreContext = createContext<EventStoreValue | null>(null);

export function EventStoreProvider({
  children,
  initialEvents = SCHEDULE_FIXTURE.events,
}: {
  children: ReactNode;
  initialEvents?: readonly CustomerEvent[];
}) {
  const [state, dispatch] = useReducer(eventStoreReducer, initialEvents, createEventStoreState);

  const highlight = useCallback((eventId: string) => {
    dispatch({ type: 'highlight', eventId });
  }, []);

  const createEvent = useCallback(
    (input: EventCreationInput) => {
      const event = buildCreatedCustomerEvent(createCustomerEventId(state.events), input);
      dispatch({ type: 'create', event });
      highlight(event.id);
      return event;
    },
    [highlight, state.events],
  );

  const editEvent = useCallback(
    (eventId: string, changes: CustomerEventEdit) => {
      const event = editEventById(state.events, eventId, changes);
      if (!event) return undefined;
      dispatch({ type: 'replace', event });
      highlight(event.id);
      return event;
    },
    [highlight, state.events],
  );

  const cancelEvent = useCallback(
    (eventId: string) => {
      const event = cancelEventById(state.events, eventId);
      if (!event) return undefined;
      dispatch({ type: 'replace', event });
      highlight(event.id);
      return event;
    },
    [highlight, state.events],
  );

  const occurEvent = useCallback(
    (eventId: string, occurredAt: string) => {
      const event = occurEventById(state.events, eventId, occurredAt);
      if (!event) return undefined;
      dispatch({ type: 'replace', event });
      highlight(event.id);
      return event;
    },
    [highlight, state.events],
  );

  const clearHighlight = useCallback((eventId?: string) => {
    dispatch({ type: 'clear-highlight', eventId });
  }, []);

  const value = useMemo<EventStoreValue>(
    () => ({
      events: state.events,
      highlightedEventId: state.highlightedEventId,
      createEvent,
      editEvent,
      cancelEvent,
      occurEvent,
      clearHighlight,
    }),
    [cancelEvent, clearHighlight, createEvent, editEvent, occurEvent, state],
  );

  return <EventStoreContext.Provider value={value}>{children}</EventStoreContext.Provider>;
}

export function useOptionalEventStore(): EventStoreValue | null {
  return useContext(EventStoreContext);
}

export function useEventStore(): EventStoreValue {
  const context = useOptionalEventStore();
  if (!context) throw new Error('useEventStore must be used within EventStoreProvider.');
  return context;
}
