/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface CustomerFormDraft {
  displayName: string;
  customerMemo: string;
}

export type CustomerFormDraftKey = 'create' | `edit:${string}`;

interface CustomerFormDraftContextValue {
  getDraft: (key: CustomerFormDraftKey) => CustomerFormDraft | undefined;
  setDraft: (key: CustomerFormDraftKey, draft: CustomerFormDraft) => void;
  clearDraft: (key: CustomerFormDraftKey) => void;
}

const CustomerFormDraftContext = createContext<CustomerFormDraftContextValue | null>(null);

export function CustomerFormDraftProvider({ children }: { children: ReactNode }) {
  const [drafts, setDrafts] = useState<Partial<Record<CustomerFormDraftKey, CustomerFormDraft>>>(
    {},
  );

  const getDraft = useCallback((key: CustomerFormDraftKey) => drafts[key], [drafts]);

  const setDraft = useCallback((key: CustomerFormDraftKey, draft: CustomerFormDraft) => {
    setDrafts((current) => ({ ...current, [key]: draft }));
  }, []);

  const clearDraft = useCallback((key: CustomerFormDraftKey) => {
    setDrafts((current) => {
      if (!current[key]) return current;
      const nextDrafts = { ...current };
      delete nextDrafts[key];
      return nextDrafts;
    });
  }, []);

  const value = useMemo<CustomerFormDraftContextValue>(
    () => ({ getDraft, setDraft, clearDraft }),
    [clearDraft, getDraft, setDraft],
  );

  return (
    <CustomerFormDraftContext.Provider value={value}>{children}</CustomerFormDraftContext.Provider>
  );
}

export function useOptionalCustomerFormDraft(): CustomerFormDraftContextValue | null {
  return useContext(CustomerFormDraftContext);
}
