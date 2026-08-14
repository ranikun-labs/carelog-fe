/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router';

export type EventCreateActivation =
  | {
      kind: 'pointer';
      clickDetail: number;
    }
  | {
      kind: 'keyboard';
      key: 'Enter' | ' ';
      repeat: boolean;
    }
  | {
      kind: 'programmatic';
    };

export type EventCreateReturnTarget =
  | {
      kind: 'schedule';
      eventId: string;
      customerId: string;
      dateKey: string;
    }
  | {
      kind: 'customer-detail';
      customerId: string;
      eventId: string;
    };

export interface EventCreateReturnProvenance {
  activation: EventCreateActivation;
  target: EventCreateReturnTarget;
}

interface EventCreateActivationContextValue {
  beginCreateSession: () => void;
  recordCreateActivation: (activation: EventCreateActivation) => void;
  armCreateReturn: (target: EventCreateReturnTarget) => void;
  getPendingCreateReturn: () => EventCreateReturnProvenance | null;
  clearCreateReturnProvenance: () => void;
}

const EventCreateActivationContext = createContext<EventCreateActivationContextValue | null>(null);

export function EventCreateActivationProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const recordedActivationRef = useRef<EventCreateActivation | null>(null);
  const pendingReturnRef = useRef<EventCreateReturnProvenance | null>(null);

  const beginCreateSession = useCallback(() => {
    recordedActivationRef.current = null;
    pendingReturnRef.current = null;
  }, []);

  const recordCreateActivation = useCallback((activation: EventCreateActivation) => {
    recordedActivationRef.current = activation;
  }, []);

  const armCreateReturn = useCallback((target: EventCreateReturnTarget) => {
    const activation = recordedActivationRef.current;
    recordedActivationRef.current = null;
    pendingReturnRef.current = activation ? { activation, target } : null;
  }, []);

  const getPendingCreateReturn = useCallback(() => pendingReturnRef.current, []);

  const clearCreateReturnProvenance = useCallback(() => {
    recordedActivationRef.current = null;
    pendingReturnRef.current = null;
  }, []);

  useEffect(() => {
    const isAuthenticatedAppRoute =
      location.pathname === '/app' || location.pathname.startsWith('/app/');
    if (!isAuthenticatedAppRoute) clearCreateReturnProvenance();
  }, [clearCreateReturnProvenance, location.pathname]);

  const value = useMemo(
    () => ({
      beginCreateSession,
      recordCreateActivation,
      armCreateReturn,
      getPendingCreateReturn,
      clearCreateReturnProvenance,
    }),
    [
      armCreateReturn,
      beginCreateSession,
      clearCreateReturnProvenance,
      getPendingCreateReturn,
      recordCreateActivation,
    ],
  );

  return (
    <EventCreateActivationContext.Provider value={value}>
      {children}
    </EventCreateActivationContext.Provider>
  );
}

export function useOptionalEventCreateActivation() {
  return useContext(EventCreateActivationContext);
}

export function useEventCreateActivation() {
  const context = useOptionalEventCreateActivation();
  if (!context) {
    throw new Error('useEventCreateActivation must be used within EventCreateActivationProvider');
  }
  return context;
}
