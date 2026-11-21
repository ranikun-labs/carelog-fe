/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
} from 'react';

export interface EventFormDraft {
  descriptor: string;
  note: string;
  scheduledAt: string;
  status?: 'PLANNED' | 'OCCURRED';
  occurredAt?: string;
}

export interface EventCreateDraft extends EventFormDraft {
  customerId: string | null;
}

type CustomerDraft = EventFormDraft & {
  customerId: string;
  sessionId: string;
  pending: boolean;
  error: string | null;
};

interface EventCreateDraftContextValue {
  draft: EventCreateDraft;
  updateDraft: (changes: Partial<EventCreateDraft>) => void;
  clearDraft: () => void;
  customerDraft: CustomerDraft | null;
  setCustomerDraft: Dispatch<SetStateAction<CustomerDraft | null>>;
  registerCustomerView: (customerId: string) => () => void;
  isCurrentCustomerDraft: (customerId: string, sessionId: string | undefined) => boolean;
}

const EMPTY_DRAFT: EventCreateDraft = {
  customerId: null,
  descriptor: '',
  note: '',
  scheduledAt: '',
};

const EventCreateDraftContext = createContext<EventCreateDraftContextValue | null>(null);

export function EventCreateDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<EventCreateDraft>(EMPTY_DRAFT);
  const [customerDraft, setCustomerDraft] = useState<CustomerDraft | null>(null);
  const customerDraftRef = useRef(customerDraft);
  useLayoutEffect(() => {
    customerDraftRef.current = customerDraft;
  }, [customerDraft]);
  const customerViewRef = useRef<{ customerId: string } | null>(null);
  const lastCustomerRef = useRef<string | null>(null);
  const invalidatedSessionRef = useRef<string | null>(null);
  const registerCustomerView = useCallback((customerId: string) => {
    if (lastCustomerRef.current !== null && lastCustomerRef.current !== customerId) {
      invalidatedSessionRef.current = customerDraftRef.current?.sessionId ?? null;
    }
    lastCustomerRef.current = customerId;
    const view = { customerId };
    customerViewRef.current = view;
    return () => {
      if (customerViewRef.current === view) customerViewRef.current = null;
    };
  }, []);
  const isCurrentCustomerDraft = useCallback(
    (customerId: string, sessionId: string | undefined) => {
      const current = customerDraftRef.current;
      return Boolean(
        sessionId &&
        invalidatedSessionRef.current !== sessionId &&
        current?.sessionId === sessionId &&
        current.customerId === customerId &&
        customerViewRef.current?.customerId === customerId,
      );
    },
    [],
  );

  const updateDraft = useCallback((changes: Partial<EventCreateDraft>) => {
    setDraft((current) => {
      const next = { ...current, ...changes };
      if (
        next.customerId === current.customerId &&
        next.descriptor === current.descriptor &&
        next.note === current.note &&
        next.scheduledAt === current.scheduledAt
      ) {
        return current;
      }
      return next;
    });
  }, []);

  const clearDraft = useCallback(() => {
    setDraft((current) => (current === EMPTY_DRAFT ? current : EMPTY_DRAFT));
  }, []);

  const value = useMemo<EventCreateDraftContextValue>(
    () => ({
      draft,
      updateDraft,
      clearDraft,
      customerDraft,
      setCustomerDraft,
      registerCustomerView,
      isCurrentCustomerDraft,
    }),
    [clearDraft, customerDraft, draft, updateDraft, registerCustomerView, isCurrentCustomerDraft],
  );

  return (
    <EventCreateDraftContext.Provider value={value}>{children}</EventCreateDraftContext.Provider>
  );
}

export function useEventCreateDraft(): EventCreateDraftContextValue {
  const context = useContext(EventCreateDraftContext);
  if (!context)
    throw new Error('useEventCreateDraft must be used within EventCreateDraftProvider.');
  return context;
}

export function useOptionalEventCreateDraft(): EventCreateDraftContextValue | null {
  return useContext(EventCreateDraftContext);
}
