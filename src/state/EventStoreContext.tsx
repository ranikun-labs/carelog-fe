/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
  useEffect,
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

/** 저장 알림 요청이 표시 대상 화면에 도달할 수 있는 최대 시간. 넘기면 스토어가 버린다. */
export const SAVED_NOTICE_MAX_AGE_MS = 10_000;

export interface SavedNoticeRequest {
  eventId: string;
  customerId: string;
  seq: number;
}

export interface EventStoreValue {
  events: readonly CustomerEvent[];
  highlightedEventId: string | null;
  /**
   * 방금 성공한 생성 한 건의 알림 요청. 저장 성공 때마다 새 `seq`(단조 증가, 데이터와 무관한 카운터)를 받는다.
   * `customerId`는 표시 범위(고객 상세는 그 고객만). 수명은 `SAVED_NOTICE_MAX_AGE_MS` 타이머가 관리한다.
   * 알림 영역이 표시하거나 수명이 다해 버릴 때 `consumeSavedNotice(seq)`로 지운다.
   */
  savedNotice: SavedNoticeRequest | null;
  consumeSavedNotice: (seq: number) => void;
  remoteReadsEnabled: boolean;
  scheduleLoadState: EventLoadState;
  detailLoadState: EventLoadState;
  detailCustomerId: string | null;
  detailError: unknown | null;
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
  remoteReadsEnabled: remoteReadsEnabledOverride,
  assertSessionOwner,
}: {
  children: ReactNode;
  initialEvents?: readonly CustomerEvent[];
  port?: CustomerEventPort;
  onFailure?: (error: unknown) => void;
  remoteReadsEnabled?: boolean;
  assertSessionOwner?: () => void;
}) {
  const isExplicitPort = providedPort !== undefined;
  const port = useMemo(
    () => providedPort ?? createInMemoryCustomerEventPort(initialEvents ?? []),
    [initialEvents, providedPort],
  );
  const seed = initialEvents ?? [];
  const [state, dispatch] = useReducer(eventStoreReducer, seed, createEventStoreState);
  const [savedNotice, setSavedNotice] = useState<SavedNoticeRequest | null>(null);
  const savedNoticeSeqRef = useRef(0);
  const [scheduleLoadState, setScheduleLoadState] = useState<EventLoadState>(
    !isExplicitPort || initialEvents !== undefined ? 'ready' : 'loading',
  );
  const [detailLoadState, setDetailLoadState] = useState<EventLoadState>('idle');
  const [detailCustomerId, setDetailCustomerId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<unknown | null>(null);
  const [mutationPending, setMutationPending] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const [errorCode, setErrorCode] = useState<ReturnType<typeof classifyCarelogError> | null>(null);
  const [snapshots, setSnapshots] = useState<Record<string, CustomerEventSnapshot>>({});
  const mountedRef = useRef(true);
  const scheduleReadGenerationRef = useRef(0);
  const detailReadGenerationRef = useRef(0);
  const eventReadGenerationRef = useRef(0);
  const mutationEpochRef = useRef(0);

  const isSessionOwner = useCallback(() => {
    try {
      assertSessionOwner?.();
      return true;
    } catch {
      return false;
    }
  }, [assertSessionOwner]);

  const requireSessionOwner = useCallback(() => {
    if (!isSessionOwner()) {
      throw new DOMException('The event operation session changed.', 'AbortError');
    }
  }, [isSessionOwner]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const remoteReadsEnabled =
    remoteReadsEnabledOverride ?? (isExplicitPort && initialEvents === undefined);

  const recordError = useCallback(
    (nextError: unknown) => {
      setError(nextError);
      setErrorCode(classifyCarelogError(nextError));
      onFailure?.(nextError);
    },
    [onFailure],
  );

  const getEvent = useCallback(
    (eventId: string) =>
      isSessionOwner() ? state.events.find((event) => event.id === eventId) : undefined,
    [isSessionOwner, state.events],
  );

  const getCustomerSnapshot = useCallback(
    (customerId: string) => (isSessionOwner() ? snapshots[customerId] : undefined),
    [isSessionOwner, snapshots],
  );

  const loadSchedule = useCallback(
    async (range: CarelogTimeRange) => {
      requireSessionOwner();
      const readGeneration = ++scheduleReadGenerationRef.current;
      const mutationEpoch = mutationEpochRef.current;
      setScheduleLoadState('loading');
      setError(null);
      setErrorCode(null);
      try {
        const events = await port.list({ from: range.from, to: range.to, limit: 100 });
        if (
          !mountedRef.current ||
          !isSessionOwner() ||
          readGeneration !== scheduleReadGenerationRef.current ||
          mutationEpoch !== mutationEpochRef.current
        ) {
          return;
        }
        dispatch({ type: 'replace-all', events });
        setScheduleLoadState('ready');
      } catch (nextError) {
        if (
          !mountedRef.current ||
          !isSessionOwner() ||
          readGeneration !== scheduleReadGenerationRef.current ||
          mutationEpoch !== mutationEpochRef.current
        ) {
          return;
        }
        recordError(nextError);
        setScheduleLoadState('error');
        throw nextError;
      } finally {
        // A confirmed mutation invalidates this read's data, not its completion.
        // Do not clear the loading state owned by a newer request or session.
        if (
          mountedRef.current &&
          isSessionOwner() &&
          readGeneration === scheduleReadGenerationRef.current &&
          mutationEpoch !== mutationEpochRef.current
        ) {
          setScheduleLoadState('ready');
        }
      }
    },
    [isSessionOwner, port, recordError, requireSessionOwner],
  );

  const loadCustomerDetail = useCallback(
    async function readLatestCustomerDetail(
      customerId: string,
      now: Date,
      resetErrorOnStart = true,
    ): Promise<void> {
      requireSessionOwner();
      const readGeneration = ++detailReadGenerationRef.current;
      const mutationEpoch = mutationEpochRef.current;
      setDetailCustomerId(customerId);
      setDetailLoadState('loading');
      setDetailError(null);
      if (resetErrorOnStart) {
        setError(null);
        setErrorCode(null);
      }
      const range = buildCustomerUpcomingRange(now, 366);
      try {
        const [upcoming, history] = await Promise.all([
          port.list(createCustomerUpcomingQuery(customerId, range, 100)),
          port.list(createCustomerHistoryQuery(customerId, 50)),
        ]);
        if (
          !mountedRef.current ||
          !isSessionOwner() ||
          readGeneration !== detailReadGenerationRef.current
        ) {
          return;
        }
        // Only a confirmed mutation invalidates the current snapshot. Refetch it
        // under a new generation instead of publishing partial or obsolete data.
        if (mutationEpoch !== mutationEpochRef.current) {
          return readLatestCustomerDetail(customerId, now, false);
        }
        setSnapshots((current) => ({ ...current, [customerId]: { upcoming, history } }));
        for (const event of [...upcoming, ...history]) dispatch({ type: 'upsert', event });
        setDetailLoadState('ready');
      } catch (nextError) {
        if (
          !mountedRef.current ||
          !isSessionOwner() ||
          readGeneration !== detailReadGenerationRef.current
        ) {
          return;
        }
        if (mutationEpoch !== mutationEpochRef.current) {
          return readLatestCustomerDetail(customerId, now, false);
        }
        recordError(nextError);
        setDetailError(nextError);
        setDetailLoadState('error');
        throw nextError;
      }
    },
    [isSessionOwner, port, recordError, requireSessionOwner],
  );

  const loadEvent = useCallback(
    async (eventId: string) => {
      requireSessionOwner();
      const readGeneration = ++eventReadGenerationRef.current;
      const mutationEpoch = mutationEpochRef.current;
      try {
        const event = await port.get(eventId);
        if (
          !mountedRef.current ||
          !isSessionOwner() ||
          readGeneration !== eventReadGenerationRef.current ||
          mutationEpoch !== mutationEpochRef.current
        ) {
          return event;
        }
        dispatch({ type: 'upsert', event });
        return event;
      } catch (nextError) {
        if (
          !mountedRef.current ||
          !isSessionOwner() ||
          readGeneration !== eventReadGenerationRef.current ||
          mutationEpoch !== mutationEpochRef.current
        ) {
          throw nextError;
        }
        recordError(nextError);
        throw nextError;
      }
    },
    [isSessionOwner, port, recordError, requireSessionOwner],
  );

  const runMutation = useCallback(
    async (operation: () => Promise<CustomerEvent>) => {
      requireSessionOwner();
      setMutationPending(true);
      setError(null);
      setErrorCode(null);
      try {
        const event = await operation();
        if (!mountedRef.current || !isSessionOwner()) {
          throw new DOMException('The event operation session changed.', 'AbortError');
        }
        mutationEpochRef.current += 1;
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
        if (!mountedRef.current || !isSessionOwner()) {
          throw new DOMException('The event operation session changed.', 'AbortError');
        }
        recordError(nextError);
        throw nextError;
      } finally {
        if (mountedRef.current) setMutationPending(false);
      }
    },
    [isSessionOwner, recordError, requireSessionOwner],
  );

  const createEvent = useCallback(
    async (input: EventCreationInput) => {
      const created = await runMutation(() => port.create(input));
      savedNoticeSeqRef.current += 1;
      const seq = savedNoticeSeqRef.current;
      setSavedNotice({
        eventId: created.id,
        customerId: created.customerId,
        seq,
      });
      // 아무 화면도 받지 않은 요청은 수명이 지나면 버린다(다음 저장 전까지 남지 않게).
      window.setTimeout(() => {
        setSavedNotice((current) => (current?.seq === seq ? null : current));
      }, SAVED_NOTICE_MAX_AGE_MS);
      return created;
    },
    [port, runMutation],
  );

  const editEvent = useCallback(
    async (eventId: string, changes: CustomerEventEdit) => {
      requireSessionOwner();
      const current = getEvent(eventId);
      if (!current) throw new Error(`Event is not available: ${eventId}`);
      return runMutation(() => port.edit(current, changes));
    },
    [getEvent, port, requireSessionOwner, runMutation],
  );

  const cancelEvent = useCallback(
    (eventId: string) => runMutation(() => port.cancel(eventId)),
    [port, runMutation],
  );

  const occurEvent = useCallback(
    (eventId: string, occurredAt?: string) => {
      requireSessionOwner();
      const current = getEvent(eventId);
      if (!current || current.status !== 'PLANNED') {
        return Promise.reject(new Error(`Event cannot be recorded: ${eventId}`));
      }
      return runMutation(() => port.occur(eventId, occurredAt ?? current.scheduledAt));
    },
    [getEvent, port, requireSessionOwner, runMutation],
  );

  const clearHighlight = useCallback((eventId?: string) => {
    dispatch({ type: 'clear-highlight', eventId });
  }, []);

  const consumeSavedNotice = useCallback((seq: number) => {
    setSavedNotice((current) => (current?.seq === seq ? null : current));
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
  }, []);

  const value = useMemo<EventStoreValue>(
    () => ({
      events: state.events,
      highlightedEventId: state.highlightedEventId,
      savedNotice,
      consumeSavedNotice,
      remoteReadsEnabled,
      scheduleLoadState,
      detailLoadState,
      detailCustomerId,
      detailError,
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
      consumeSavedNotice,
      createEvent,
      detailLoadState,
      detailCustomerId,
      detailError,
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
      savedNotice,
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
