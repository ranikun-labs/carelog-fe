/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from 'react';

import type { CustomerEvent, CustomerEventEdit } from '@/domain/customerEvent';
import { classifyCarelogError } from '@/integrations/carelog/errorMapping';
import { createInMemoryCustomerEventPort } from '@/integrations/carelog/inMemoryPorts';
import {
  createCustomerHistoryQuery,
  createCustomerUpcomingQuery,
  type CustomerEventPort,
} from '@/integrations/carelog/customerEventPort';
import {
  buildCustomerUpcomingRange,
  type CarelogTimeRange,
} from '@/integrations/carelog/timeRange';
import {
  createEventStoreState,
  eventStoreReducer,
  type EventCreationInput,
} from '@/state/eventStore';

export type EventLoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface CustomerEventSnapshot {
  upcoming: readonly CustomerEvent[];
  history: readonly CustomerEvent[];
}

export interface EventStoreValue {
  events: readonly CustomerEvent[];
  highlightedEventId: string | null;
  remoteReadsEnabled: boolean;
  scheduleLoadState: EventLoadState;
  detailLoadState: EventLoadState;
  mutationPending: boolean;
  error: unknown | null;
  errorCode: ReturnType<typeof classifyCarelogError> | null;
  getEvent: (eventId: string) => CustomerEvent | undefined;
  getCustomerSnapshot: (customerId: string) => CustomerEventSnapshot | undefined;
  loadSchedule: (range: CarelogTimeRange) => Promise<void>;
  loadCustomerDetail: (customerId: string, now: Date) => Promise<void>;
  loadEvent: (eventId: string) => Promise<CustomerEvent>;
  createEvent: (input: EventCreationInput) => Promise<CustomerEvent>;
  editEvent: (eventId: string, changes: CustomerEventEdit) => Promise<CustomerEvent>;
  cancelEvent: (eventId: string) => Promise<CustomerEvent>;
  occurEvent: (eventId: string, occurredAt?: string) => Promise<CustomerEvent>;
  clearHighlight: (eventId?: string) => void;
  clearError: () => void;
}

const EventStoreContext = createContext<EventStoreValue | null>(null);

export function EventStoreProvider({
  children,
  initialEvents,
  port: providedPort,
  onFailure,
}: {
  children: ReactNode;
  initialEvents?: readonly CustomerEvent[];
  port?: CustomerEventPort;
  onFailure?: (error: unknown) => void;
}) {
  const isExplicitPort = providedPort !== undefined;
  const port = useMemo(
    () => providedPort ?? createInMemoryCustomerEventPort(initialEvents ?? []),
    [initialEvents, providedPort],
  );
  const seed = initialEvents ?? [];
  const [state, dispatch] = useReducer(eventStoreReducer, seed, createEventStoreState);
  const [scheduleLoadState, setScheduleLoadState] = useState<EventLoadState>(
    !isExplicitPort || initialEvents !== undefined ? 'ready' : 'loading',
  );
  const [detailLoadState, setDetailLoadState] = useState<EventLoadState>('idle');
  const [mutationPending, setMutationPending] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [errorCode, setErrorCode] = useState<ReturnType<typeof classifyCarelogError> | null>(null);
  const [snapshots, setSnapshots] = useState<Record<string, CustomerEventSnapshot>>({});
  const remoteReadsEnabled = isExplicitPort && initialEvents === undefined;

  const recordError = useCallback(
    (nextError: unknown) => {
      setError(nextError);
      setErrorCode(classifyCarelogError(nextError));
      onFailure?.(nextError);
    },
    [onFailure],
  );

  const getEvent = useCallback(
    (eventId: string) => state.events.find((event) => event.id === eventId),
    [state.events],
  );

  const getCustomerSnapshot = useCallback(
    (customerId: string) => snapshots[customerId],
    [snapshots],
  );

  const loadSchedule = useCallback(
    async (range: CarelogTimeRange) => {
      setScheduleLoadState('loading');
      setError(null);
      setErrorCode(null);
      try {
        const events = await port.list({ from: range.from, to: range.to, limit: 100 });
        dispatch({ type: 'replace-all', events });
        setScheduleLoadState('ready');
      } catch (nextError) {
        recordError(nextError);
        setScheduleLoadState('error');
        throw nextError;
      }
    },
    [port, recordError],
  );

  const loadCustomerDetail = useCallback(
    async (customerId: string, now: Date) => {
      setDetailLoadState('loading');
      setError(null);
      setErrorCode(null);
      const range = buildCustomerUpcomingRange(now, 366);
      try {
        const [upcoming, history] = await Promise.all([
          port.list(createCustomerUpcomingQuery(customerId, range, 100)),
          port.list(createCustomerHistoryQuery(customerId, 50)),
        ]);
        setSnapshots((current) => ({ ...current, [customerId]: { upcoming, history } }));
        for (const event of [...upcoming, ...history]) dispatch({ type: 'upsert', event });
        setDetailLoadState('ready');
      } catch (nextError) {
        recordError(nextError);
        setDetailLoadState('error');
        throw nextError;
      }
    },
    [port, recordError],
  );

  const loadEvent = useCallback(
    async (eventId: string) => {
      try {
        const event = await port.get(eventId);
        dispatch({ type: 'upsert', event });
        return event;
      } catch (nextError) {
        recordError(nextError);
        throw nextError;
      }
    },
    [port, recordError],
  );

  const runMutation = useCallback(
    async (operation: () => Promise<CustomerEvent>) => {
      setMutationPending(true);
      setError(null);
      setErrorCode(null);
      try {
        const event = await operation();
        dispatch({ type: 'upsert', event });
        dispatch({ type: 'highlight', eventId: event.id });
        setSnapshots((current) => {
          const snapshot = current[event.customerId];
          if (!snapshot) return current;
          const withoutEvent = (events: readonly CustomerEvent[]) =>
            events.filter((candidate) => candidate.id !== event.id);
          const next =
            event.status === 'PLANNED'
              ? {
                  upcoming: [...withoutEvent(snapshot.upcoming), event],
                  history: withoutEvent(snapshot.history),
                }
              : {
                  upcoming: withoutEvent(snapshot.upcoming),
                  history: [...withoutEvent(snapshot.history), event],
                };
          return { ...current, [event.customerId]: next };
        });
        return event;
      } catch (nextError) {
        recordError(nextError);
        throw nextError;
      } finally {
        setMutationPending(false);
      }
    },
    [recordError],
  );

  const createEvent = useCallback(
    (input: EventCreationInput) => runMutation(() => port.create(input)),
    [port, runMutation],
  );

  const editEvent = useCallback(
    async (eventId: string, changes: CustomerEventEdit) => {
      const current = getEvent(eventId);
      if (!current) throw new Error(`Event is not available: ${eventId}`);
      return runMutation(() => port.edit(current, changes));
    },
    [getEvent, port, runMutation],
  );

  const cancelEvent = useCallback(
    (eventId: string) => runMutation(() => port.cancel(eventId)),
    [port, runMutation],
  );

  const occurEvent = useCallback(
    (eventId: string, occurredAt?: string) => {
      const current = getEvent(eventId);
      if (!current || current.status !== 'PLANNED') {
        return Promise.reject(new Error(`Event cannot be recorded: ${eventId}`));
      }
      return runMutation(() => port.occur(eventId, occurredAt ?? current.scheduledAt));
    },
    [getEvent, port, runMutation],
  );

  const clearHighlight = useCallback((eventId?: string) => {
    dispatch({ type: 'clear-highlight', eventId });
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
  }, []);

  const value = useMemo<EventStoreValue>(
    () => ({
      events: state.events,
      highlightedEventId: state.highlightedEventId,
      remoteReadsEnabled,
      scheduleLoadState,
      detailLoadState,
      mutationPending,
      error,
      errorCode,
      getEvent,
      getCustomerSnapshot,
      loadSchedule,
      loadCustomerDetail,
      loadEvent,
      createEvent,
      editEvent,
      cancelEvent,
      occurEvent,
      clearHighlight,
      clearError,
    }),
    [
      cancelEvent,
      clearError,
      clearHighlight,
      createEvent,
      detailLoadState,
      editEvent,
      error,
      errorCode,
      getCustomerSnapshot,
      getEvent,
      loadCustomerDetail,
      loadEvent,
      loadSchedule,
      mutationPending,
      occurEvent,
      remoteReadsEnabled,
      scheduleLoadState,
      state.events,
      state.highlightedEventId,
    ],
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
