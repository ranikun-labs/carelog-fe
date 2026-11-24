/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { EventFormDraft } from '@/state/EventCreateDraftContext';

export interface CustomerFormDraft {
  displayName: string;
  customerMemo: string;
}

/** 고객 상세의 인라인 일정 추가 폼. 열림 여부 + 입력값을 함께 들고, 회전으로 화면이 다시 마운트돼도 이어 쓰게 한다. */
export type InlineEventDraft = EventFormDraft;

export type CustomerFormDraftKey = 'create' | `edit:${string}`;

interface CustomerFormDraftContextValue {
  getDraft: (key: CustomerFormDraftKey) => CustomerFormDraft | undefined;
  setDraft: (key: CustomerFormDraftKey, draft: CustomerFormDraft) => void;
  clearDraft: (key: CustomerFormDraftKey) => void;
  getInlineEventDraft: (customerId: string) => InlineEventDraft | undefined;
  setInlineEventDraft: (customerId: string, draft: InlineEventDraft) => void;
  clearInlineEventDraft: (customerId: string) => void;
  getAssistantQuestionDraft: (contextKey: string) => string | undefined;
  setAssistantQuestionDraft: (contextKey: string, question: string) => void;
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

  const [eventDrafts, setEventDrafts] = useState<Record<string, InlineEventDraft>>({});

  const getInlineEventDraft = useCallback(
    (customerId: string) => eventDrafts[customerId],
    [eventDrafts],
  );

  const setInlineEventDraft = useCallback((customerId: string, draft: InlineEventDraft) => {
    setEventDrafts((current) => {
      const previous = current[customerId];
      if (previous && JSON.stringify(previous) === JSON.stringify(draft)) return current;
      return { ...current, [customerId]: draft };
    });
  }, []);

  const clearInlineEventDraft = useCallback((customerId: string) => {
    setEventDrafts((current) => {
      if (!current[customerId]) return current;
      const next = { ...current };
      delete next[customerId];
      return next;
    });
  }, []);

  // 도우미 질문 입력: 1단↔2단 회전으로 화면이 다시 마운트돼도 입력 중이던 질문을 이어 쓰게 한다(메모리 보존만, 저장·전송과 무관).
  const [assistantQuestions, setAssistantQuestions] = useState<Record<string, string>>({});

  const getAssistantQuestionDraft = useCallback(
    (contextKey: string) => assistantQuestions[contextKey],
    [assistantQuestions],
  );

  const setAssistantQuestionDraft = useCallback((contextKey: string, question: string) => {
    setAssistantQuestions((current) =>
      current[contextKey] === question ? current : { ...current, [contextKey]: question },
    );
  }, []);

  const value = useMemo<CustomerFormDraftContextValue>(
    () => ({
      getDraft,
      setDraft,
      clearDraft,
      getInlineEventDraft,
      setInlineEventDraft,
      clearInlineEventDraft,
      getAssistantQuestionDraft,
      setAssistantQuestionDraft,
    }),
    [
      clearDraft,
      clearInlineEventDraft,
      getAssistantQuestionDraft,
      getDraft,
      getInlineEventDraft,
      setAssistantQuestionDraft,
      setDraft,
      setInlineEventDraft,
    ],
  );

  return (
    <CustomerFormDraftContext.Provider value={value}>{children}</CustomerFormDraftContext.Provider>
  );
}

export function useOptionalCustomerFormDraft(): CustomerFormDraftContextValue | null {
  return useContext(CustomerFormDraftContext);
}
