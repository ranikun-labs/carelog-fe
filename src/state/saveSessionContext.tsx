/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * 저장 세션 소유권. 저장 중·중복 제출 잠금과 "지금 이 화면이 그 저장의 주인인지"를 공급자 수준에 둔다.
 * - 화면이 회전·재마운트되어도 저장 중 상태(saving)는 공급자에 남아 입력·제출 잠금을 유지한다.
 * - 저장 응답이 돌아왔을 때 화면 소유권(setActive로 등록한 현재 업무 대상)과 세대(gen)가 같을 때만 후속 처리를 한다.
 * 공급자가 없으면 호출부는 기존처럼 인스턴스 마운트 여부로 판단한다.
 */
export interface SaveSessionValue {
  /** 지금 보이는 업무 대상 키를 등록한다(true) 또는 해제한다(false, 같은 키일 때만). */
  setActive(key: string, active: boolean): void;
  isSaving(key: string): boolean;
  /** 새 저장을 시작하고 세대를 돌려준다. 같은 키의 이전 세대는 더 이상 현재가 아니다. */
  beginSave(key: string): number;
  endSave(key: string, gen: number): void;
  /** 응답이 돌아왔을 때 이 세대가 여전히 지금 화면의 저장인지. */
  isCurrent(key: string, gen: number): boolean;
}

const SaveSessionContext = createContext<SaveSessionValue | null>(null);

export function SaveSessionProvider({ children }: { children: ReactNode }) {
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const activeRef = useRef<string | null>(null);
  const genRef = useRef<Record<string, number>>({});

  const setActive = useCallback((key: string, active: boolean) => {
    if (active) activeRef.current = key;
    else if (activeRef.current === key) activeRef.current = null;
  }, []);

  const isSaving = useCallback((key: string) => saving[key] === true, [saving]);

  const beginSave = useCallback((key: string) => {
    const gen = (genRef.current[key] ?? 0) + 1;
    genRef.current[key] = gen;
    setSaving((current) => ({ ...current, [key]: true }));
    return gen;
  }, []);

  const endSave = useCallback((key: string, gen: number) => {
    if (genRef.current[key] !== gen) return;
    setSaving((current) => ({ ...current, [key]: false }));
  }, []);

  const isCurrent = useCallback(
    (key: string, gen: number) => activeRef.current === key && genRef.current[key] === gen,
    [],
  );

  const value = useMemo<SaveSessionValue>(
    () => ({ setActive, isSaving, beginSave, endSave, isCurrent }),
    [beginSave, endSave, isCurrent, isSaving, setActive],
  );

  return <SaveSessionContext.Provider value={value}>{children}</SaveSessionContext.Provider>;
}

export function useOptionalSaveSession(): SaveSessionValue | null {
  return useContext(SaveSessionContext);
}
