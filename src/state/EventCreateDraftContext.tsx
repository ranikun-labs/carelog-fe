/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface EventFormDraft {
  descriptor: string;
  note: string;
  scheduledAt: string;
}

export interface EventCreateDraft extends EventFormDraft {
  customerId: string | null;
}

interface EventCreateDraftContextValue {
  draft: EventCreateDraft;
  updateDraft: (changes: Partial<EventCreateDraft>) => void;
  clearDraft: () => void;
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
    () => ({ draft, updateDraft, clearDraft }),
    [clearDraft, draft, updateDraft],
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
