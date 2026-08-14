/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from 'react';

export type ScheduleCreateActivation =
  | { kind: 'pointer'; clientX: number; clientY: number }
  | { kind: 'keyboard' }
  | { kind: 'unknown' };

interface ScheduleActivationGuardValue {
  armScheduleCreateActivation: (activation: ScheduleCreateActivation) => void;
  getPendingScheduleCreateActivation: () => ScheduleCreateActivation | null;
  clearPendingScheduleCreateActivation: () => void;
}

const ScheduleActivationGuardContext = createContext<ScheduleActivationGuardValue | null>(null);

export function ScheduleActivationGuardProvider({ children }: { children: ReactNode }) {
  const pendingActivationRef = useRef<ScheduleCreateActivation | null>(null);

  const armScheduleCreateActivation = useCallback((activation: ScheduleCreateActivation) => {
    pendingActivationRef.current = activation;
  }, []);

  const getPendingScheduleCreateActivation = useCallback(() => pendingActivationRef.current, []);

  const clearPendingScheduleCreateActivation = useCallback(() => {
    pendingActivationRef.current = null;
  }, []);

  const value = useMemo<ScheduleActivationGuardValue>(
    () => ({
      armScheduleCreateActivation,
      getPendingScheduleCreateActivation,
      clearPendingScheduleCreateActivation,
    }),
    [
      armScheduleCreateActivation,
      clearPendingScheduleCreateActivation,
      getPendingScheduleCreateActivation,
    ],
  );

  return (
    <ScheduleActivationGuardContext.Provider value={value}>
      {children}
    </ScheduleActivationGuardContext.Provider>
  );
}

export function useScheduleActivationGuard(): ScheduleActivationGuardValue {
  const context = useContext(ScheduleActivationGuardContext);
  if (!context) {
    throw new Error(
      'useScheduleActivationGuard must be used within ScheduleActivationGuardProvider.',
    );
  }
  return context;
}
