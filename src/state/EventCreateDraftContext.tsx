/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useInRouterContext, useLocation } from 'react-router';

import { APP_ROUTE_PATHS } from '@/constants/routes';

export interface EventFormDraft {
  descriptor: string;
  note: string;
  scheduledAt: string;
  /** 고객 상세 인라인 폼처럼 기록 방식을 고를 수 있는 곳에서만 채워진다(회전·창 크기 변경 시 보존용). */
  status?: 'PLANNED' | 'OCCURRED';
  occurredAt?: string;
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

/**
 * 생성 세션이 끝나면 초안을 버린다. 라우터 안에서만 동작한다. 같은 경로 안의 재마운트(회전·창 크기 변경)는 보존한다.
 * 키로 Provider를 리셋하면 트리 전체가 재마운트되므로(#52 원인) 경로 이탈 시점에만 비운다.
 */
function EventCreateDraftRouteReset({ onLeaveCreate }: { onLeaveCreate: () => void }) {
  const { pathname } = useLocation();
  const previousPathRef = useRef(pathname);
  useEffect(() => {
    const previous = previousPathRef.current;
    previousPathRef.current = pathname;
    if (previous !== pathname && previous === APP_ROUTE_PATHS.eventCreate) onLeaveCreate();
  }, [onLeaveCreate, pathname]);
  return null;
}

export function EventCreateDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<EventCreateDraft>(EMPTY_DRAFT);
  const inRouter = useInRouterContext();

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
    <EventCreateDraftContext.Provider value={value}>
      {inRouter ? <EventCreateDraftRouteReset onLeaveCreate={clearDraft} /> : null}
      {children}
    </EventCreateDraftContext.Provider>
  );
}

export function useEventCreateDraft(): EventCreateDraftContextValue {
  const context = useContext(EventCreateDraftContext);
  if (!context)
    throw new Error('useEventCreateDraft must be used within EventCreateDraftProvider.');
  return context;
}
