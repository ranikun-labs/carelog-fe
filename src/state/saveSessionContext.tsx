/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useInRouterContext, useLocation } from 'react-router';

/**
 * 저장 세션 (SaveSessionProvider). 책임 경계:
 * - Store: 서버 저장 결과와 데이터 반영 (이 Provider는 건드리지 않는다)
 * - Draft: 입력값 보존 (이 Provider는 건드리지 않는다)
 * - SaveSessionProvider: 방문·요청의 식별, 진행, 잠금, 이탈 허용, 실패 상태
 * - Form: 입력·검증·인터랙션
 *
 * 방문(visit): 라우터 항목(location.key) 하나 + 지금 보이는 업무 대상. 회전·리사이즈로 화면이
 *   재마운트되어도 location.key는 같으므로 같은 방문이다. 떠나거나 다시 들어오면(새 location.key) 새 방문이다.
 * 요청(request): 한 방문에서 진행 중인 저장 하나. 요청은 방문 키와 대상을 함께 기록한다.
 *
 * 불변식:
 * - 현재 방문과 요청이 모두 일치할 때만 소유권이 있다(isCurrent).
 * - 이전 방문의 요청은 새 방문의 잠금·상태를 바꿀 수 없다(beginRequest는 이전 방문 요청을 무시).
 * - 허용(allowLeave)은 현재 요청이 소유권을 가질 때만 기록된다(성공 확인 뒤, 이동 전).
 */
export interface SaveRequestToken {
  visitKey: string;
  target: string;
  requestId: number;
}

/**
 * 이 대상의 현재 방문에서 저장의 상태. "saving" 저장 중, "failed" 실패(메시지와 제출 스냅샷),
 * "completed" 성공(재마운트된 폼이 같은 입력을 다시 내지 않도록 기록).
 * 스냅샷은 화면이 제출한 입력값이다(저장 중에는 입력이 잠기므로 제출값 = 사용자 입력). 재마운트된 화면이 복구에 쓴다.
 */
export interface SaveRecord {
  status: 'saving' | 'failed' | 'completed';
  message: string | null;
  snapshot: unknown;
}

export interface SaveFailure {
  message: string;
  snapshot?: unknown;
}

export interface SaveSessionValue {
  /** 지금 보이는 업무 대상을 등록한다(true) 또는 해제한다(false, 같은 대상일 때만). */
  setActive(target: string, active: boolean): void;
  /** 이 대상의 현재 방문에 진행 중인 저장이 있는지(재마운트 뒤에도 유지). */
  isSaving(target: string): boolean;
  /** 저장 요청을 시작한다. 같은 방문에 진행 중인 요청이 있으면 null. snapshot은 제출 입력값. */
  beginRequest(target: string, snapshot?: unknown): SaveRequestToken | null;
  /**
   * 요청을 끝낸다. 현재 요청일 때만 상태를 바꾼다. 성공(failure 없음)이면 기록을 지우고,
   * 실패면 메시지와 스냅샷을 남겨 재마운트된 화면도 읽게 한다.
   */
  finishRequest(token: SaveRequestToken, failure?: SaveFailure): void;
  /** 이 대상의 현재 방문 저장 상태를 읽는다. 없으면 null. */
  saveRecordFor(target: string): SaveRecord | null;
  /** 이 대상의 완료·실패 기록을 지운다(진행 중인 저장은 건드리지 않는다). 새 입력을 시작할 때 쓴다. */
  clearRecord(target: string): void;
  /** 응답이 돌아왔을 때 이 요청이 지금 방문·대상의 현재 요청인지. */
  isCurrent(token: SaveRequestToken): boolean;
  /** 성공을 확인한 현재 요청에 대해 이 방문의 이탈을 허용한다(이동 전에 호출). */
  allowLeave(token: SaveRequestToken): void;
  /** 이 방문에서 이탈이 허용되었는지(가드가 막지 않음). */
  isLeaveAllowed(): boolean;
}

const SaveSessionContext = createContext<SaveSessionValue | null>(null);

interface Record {
  visitKey: string;
  target: string;
  status: 'saving' | 'failed' | 'completed';
  message: string | null;
  snapshot: unknown;
}

interface CoreProps {
  visitKey: string;
  children: ReactNode;
}

function SaveSessionCore({ visitKey, children }: CoreProps) {
  const [current, setCurrent] = useState<SaveRequestToken | null>(null);
  const [record, setRecord] = useState<Record | null>(null);
  const visitKeyRef = useRef(visitKey);
  const currentRef = useRef<SaveRequestToken | null>(null);
  const activeRef = useRef<string | null>(null);
  const allowedRef = useRef<string | null>(null);
  const disposedRef = useRef(false);
  const seqRef = useRef(0);

  useLayoutEffect(() => {
    visitKeyRef.current = visitKey;
  }, [visitKey]);

  // 공급자가 해제되면 이후 응답은 어떤 방문도 소유하지 못한다(StrictMode 재실행에도 다시 연다).
  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
    };
  }, []);

  const setActive = useCallback((target: string, active: boolean) => {
    if (active) activeRef.current = target;
    else if (activeRef.current === target) activeRef.current = null;
  }, []);

  const beginRequest = useCallback((target: string, snapshot?: unknown) => {
    const existing = currentRef.current;
    // 같은 방문에 진행 중 요청이 이미 있으면 하나만 허용한다. 이전 방문의 요청은 무시한다.
    if (existing && existing.visitKey === visitKeyRef.current) return null;
    seqRef.current += 1;
    const token: SaveRequestToken = {
      visitKey: visitKeyRef.current,
      target,
      requestId: seqRef.current,
    };
    currentRef.current = token;
    allowedRef.current = null;
    setCurrent(token);
    setRecord({
      visitKey: token.visitKey,
      target,
      status: 'saving',
      message: null,
      snapshot,
    });
    return token;
  }, []);

  const finishRequest = useCallback((token: SaveRequestToken, failure?: SaveFailure) => {
    if (currentRef.current?.requestId !== token.requestId) return;
    currentRef.current = null;
    setCurrent(null);
    setRecord(
      failure
        ? {
            visitKey: token.visitKey,
            target: token.target,
            status: 'failed',
            message: failure.message,
            snapshot: failure.snapshot,
          }
        : {
            visitKey: token.visitKey,
            target: token.target,
            status: 'completed',
            message: null,
            snapshot: undefined,
          },
    );
  }, []);

  const clearRecord = useCallback((target: string) => {
    setRecord((previous) =>
      previous !== null &&
      previous.visitKey === visitKeyRef.current &&
      previous.target === target &&
      previous.status !== 'saving'
        ? null
        : previous,
    );
  }, []);

  const saveRecordFor = useCallback(
    (target: string): SaveRecord | null =>
      record !== null && record.visitKey === visitKey && record.target === target
        ? { status: record.status, message: record.message, snapshot: record.snapshot }
        : null,
    [record, visitKey],
  );

  const isCurrent = useCallback((token: SaveRequestToken) => {
    if (disposedRef.current) return false;
    const active = activeRef.current;
    return (
      token.visitKey === visitKeyRef.current &&
      (active === null || active === token.target) &&
      currentRef.current?.requestId === token.requestId
    );
  }, []);

  const allowLeave = useCallback((token: SaveRequestToken) => {
    if (disposedRef.current) return;
    if (token.visitKey !== visitKeyRef.current) return;
    if (currentRef.current?.requestId !== token.requestId) return;
    allowedRef.current = token.visitKey;
  }, []);

  const isLeaveAllowed = useCallback(
    () => allowedRef.current !== null && allowedRef.current === visitKeyRef.current,
    [],
  );

  const isSaving = useCallback(
    (target: string) =>
      current !== null && current.visitKey === visitKey && current.target === target,
    [current, visitKey],
  );

  const value = useMemo<SaveSessionValue>(
    () => ({
      setActive,
      isSaving,
      beginRequest,
      finishRequest,
      saveRecordFor,
      clearRecord,
      isCurrent,
      allowLeave,
      isLeaveAllowed,
    }),
    [
      allowLeave,
      beginRequest,
      finishRequest,
      saveRecordFor,
      clearRecord,
      isCurrent,
      isLeaveAllowed,
      isSaving,
      setActive,
    ],
  );

  return <SaveSessionContext.Provider value={value}>{children}</SaveSessionContext.Provider>;
}

/**
 * 라우터 안에서는 방문 키 = (방문 순번, location.key). location.key만 쓰면 POP 뒤로가기가
 * 같은 key를 되살려 떠난 방문의 허용·요청이 다시 유효해지므로, location이 바뀔 때마다 순번을 올린다.
 */
function RouterSaveSession({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [visit, setVisit] = useState({ locationKey: location.key, sequence: 0 });
  let currentVisit = visit;
  if (visit.locationKey !== location.key) {
    currentVisit = { locationKey: location.key, sequence: visit.sequence + 1 };
    setVisit(currentVisit);
  }
  return (
    <SaveSessionCore visitKey={`${currentVisit.sequence}:${location.key}`}>
      {children}
    </SaveSessionCore>
  );
}

export function SaveSessionProvider({ children }: { children: ReactNode }) {
  const inRouter = useInRouterContext();
  return inRouter ? (
    <RouterSaveSession>{children}</RouterSaveSession>
  ) : (
    <SaveSessionCore visitKey="no-router">{children}</SaveSessionCore>
  );
}

export function useOptionalSaveSession(): SaveSessionValue | null {
  return useContext(SaveSessionContext);
}
