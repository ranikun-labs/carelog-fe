/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import {
  AUTH_ERROR_KIND,
  AUTH_STATE,
  type AuthBootstrapResult,
  type AuthCommandResult,
  type AuthCredentialFixture,
  type AuthFailure,
  type AuthPort,
  type AuthSignupFixture,
  type AuthState,
} from '@/auth/authTypes';
import { authStateReducer, INITIAL_AUTH_STATE } from '@/auth/authStateMachine';
import { createUnavailableAuthPort } from '@/auth/unavailableAuthPort';

export interface AuthOperationError {
  failure: AuthFailure;
  retry?: () => void | Promise<void>;
}

export interface AuthContextValue {
  authState: AuthState;
  /** Changes at account/session boundaries, but not during token recovery. */
  sessionRevision: number;
  isSessionCurrent: (sessionRevision: number) => boolean;
  failClosedSession: (sessionRevision: number) => boolean;
  operationError: AuthOperationError | null;
  login: (input: AuthCredentialFixture) => Promise<AuthCommandResult>;
  signup: (input: AuthSignupFixture) => Promise<AuthCommandResult>;
  logout: () => Promise<void>;
  retryBootstrap: () => void;
  reportFailure: (failure: AuthFailure, retry?: () => void | Promise<void>) => void;
  retryOperation: () => Promise<void>;
  clearOperationError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeFailure(error: unknown): AuthFailure {
  if (typeof error === 'object' && error !== null) {
    const kind = (error as { kind?: unknown }).kind;
    if (
      kind === AUTH_ERROR_KIND.UNAUTHORIZED ||
      kind === AUTH_ERROR_KIND.FORBIDDEN ||
      kind === AUTH_ERROR_KIND.SERVER ||
      kind === AUTH_ERROR_KIND.NETWORK ||
      kind === AUTH_ERROR_KIND.UNKNOWN
    ) {
      return { kind };
    }
  }
  return { kind: AUTH_ERROR_KIND.UNKNOWN };
}

function isSuccessful(result: AuthCommandResult): result is { ok: true } {
  return result.ok;
}

export function AuthProvider({ children, authPort }: { children: ReactNode; authPort?: AuthPort }) {
  const [port] = useState<AuthPort>(() => authPort ?? createUnavailableAuthPort());
  const [authState, dispatch] = useReducer(authStateReducer, INITIAL_AUTH_STATE);
  const [sessionRevision, setSessionRevision] = useState(0);
  const sessionRevisionRef = useRef(0);
  const [operationError, setOperationError] = useState<AuthOperationError | null>(null);
  const authStateRef = useRef(authState);
  const recoveryAttemptRef = useRef(0);
  const recoveryPromiseRef = useRef<Promise<boolean> | null>(null);
  const sessionEpochRef = useRef(0);
  const bootstrapGenerationRef = useRef(0);
  const bootstrapPromiseRef = useRef<Promise<void> | null>(null);
  const logoutPromiseRef = useRef<Promise<void> | null>(null);
  const logoutEpochRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const operationErrorRef = useRef<AuthOperationError | null>(null);

  useEffect(() => {
    authStateRef.current = authState;
    operationErrorRef.current = operationError;
  }, [authState, operationError]);

  const setCurrentOperationError = useCallback((next: AuthOperationError | null) => {
    operationErrorRef.current = next;
    if (mountedRef.current) setOperationError(next);
  }, []);

  const isSessionCurrent = useCallback(
    (expectedRevision: number) =>
      mountedRef.current && expectedRevision === sessionRevisionRef.current,
    [],
  );

  const invalidateSessionWork = useCallback(() => {
    sessionEpochRef.current += 1;
    bootstrapGenerationRef.current += 1;
    bootstrapPromiseRef.current = null;
    recoveryPromiseRef.current = null;
    recoveryAttemptRef.current = 0;
    sessionRevisionRef.current += 1;
    setSessionRevision(sessionRevisionRef.current);
    setCurrentOperationError(null);
    authStateRef.current = { status: AUTH_STATE.ANONYMOUS };
    return sessionEpochRef.current;
  }, [setCurrentOperationError]);

  const failClosedSession = useCallback(
    (expectedRevision: number): boolean => {
      if (!isSessionCurrent(expectedRevision) || logoutPromiseRef.current) return false;
      invalidateSessionWork();
      if (mountedRef.current) dispatch({ type: 'logout-anonymous' });
      return true;
    },
    [invalidateSessionWork, isSessionCurrent],
  );

  const recoverSession = useCallback((): Promise<boolean> => {
    if (logoutPromiseRef.current) return Promise.resolve(false);
    const inFlight = recoveryPromiseRef.current;
    if (inFlight) return inFlight;
    if (recoveryAttemptRef.current >= 1) {
      if (mountedRef.current) dispatch({ type: 'recovery-anonymous' });
      return Promise.resolve(false);
    }

    recoveryAttemptRef.current += 1;
    const recoveryEpoch = sessionEpochRef.current;
    if (mountedRef.current) {
      dispatch({ type: 'recovery-start', attempt: recoveryAttemptRef.current });
    }
    setCurrentOperationError(null);

    const promise = (async () => {
      let result: AuthCommandResult;
      try {
        result = await port.recoverSession();
      } catch (error) {
        result = { ok: false, failure: normalizeFailure(error) };
      }

      if (!mountedRef.current || recoveryEpoch !== sessionEpochRef.current) return false;
      if (isSuccessful(result)) {
        dispatch({ type: 'recovery-authenticated' });
        return true;
      }
      if (result.failure.kind !== AUTH_ERROR_KIND.UNAUTHORIZED) {
        dispatch({ type: 'recovery-authenticated' });
        setCurrentOperationError({ failure: result.failure });
        return false;
      }
      dispatch({ type: 'recovery-anonymous' });
      return false;
    })().finally(() => {
      if (recoveryPromiseRef.current !== promise) return;
      recoveryPromiseRef.current = null;
      recoveryAttemptRef.current = 0;
    });
    recoveryPromiseRef.current = promise;
    return promise;
  }, [port, setCurrentOperationError]);

  const applyBootstrapResult = useCallback(
    async (result: AuthBootstrapResult, generation: number): Promise<void> => {
      if (!mountedRef.current || bootstrapGenerationRef.current !== generation) return;
      if (result.status === 'authenticated') {
        recoveryAttemptRef.current = 0;
        dispatch({ type: 'bootstrap-authenticated' });
        return;
      }
      if (result.status === 'anonymous') {
        recoveryAttemptRef.current = 0;
        dispatch({ type: 'bootstrap-anonymous' });
        return;
      }
      if (result.status === 'recoverable') {
        await recoverSession();
        return;
      }
      dispatch({ type: 'bootstrap-error', error: result.failure });
    },
    [recoverSession],
  );

  const runBootstrap = useCallback(
    (force = false): void => {
      if (!force && bootstrapPromiseRef.current) return;
      if (force) {
        invalidateSessionWork();
      }

      const generation = bootstrapGenerationRef.current + 1;
      bootstrapGenerationRef.current = generation;
      if (!mountedRef.current) return;
      dispatch({ type: 'bootstrap-start' });
      const promise = (async () => {
        try {
          const result = await port.bootstrapSession();
          await applyBootstrapResult(result, generation);
        } catch (error) {
          if (mountedRef.current && bootstrapGenerationRef.current === generation) {
            dispatch({ type: 'bootstrap-error', error: normalizeFailure(error) });
          }
        }
      })();
      bootstrapPromiseRef.current = promise;
      void promise.then(
        () => {
          if (bootstrapPromiseRef.current === promise) bootstrapPromiseRef.current = null;
        },
        () => {
          if (bootstrapPromiseRef.current === promise) bootstrapPromiseRef.current = null;
        },
      );
    },
    [applyBootstrapResult, invalidateSessionWork, port],
  );

  useEffect(() => {
    mountedRef.current = true;
    runBootstrap();
    return () => {
      mountedRef.current = false;
      port.cancelPendingLogin?.();
      sessionEpochRef.current += 1;
      bootstrapGenerationRef.current += 1;
      bootstrapPromiseRef.current = null;
      recoveryPromiseRef.current = null;
      logoutPromiseRef.current = null;
    };
  }, [port, runBootstrap]);

  const login = useCallback(
    async (input: AuthCredentialFixture): Promise<AuthCommandResult> => {
      if (!mountedRef.current) {
        return { ok: false, failure: { kind: AUTH_ERROR_KIND.UNKNOWN } };
      }
      const operationEpoch = invalidateSessionWork();
      if (mountedRef.current) dispatch({ type: 'logout-anonymous' });
      try {
        const result = await port.login(input);
        if (
          isSuccessful(result) &&
          mountedRef.current &&
          operationEpoch === sessionEpochRef.current
        ) {
          recoveryAttemptRef.current = 0;
          setCurrentOperationError(null);
          dispatch({ type: 'login-authenticated' });
        }
        return result;
      } catch (error) {
        return { ok: false, failure: normalizeFailure(error) };
      }
    },
    [invalidateSessionWork, port, setCurrentOperationError],
  );

  const signup = useCallback(
    async (input: AuthSignupFixture): Promise<AuthCommandResult> => {
      const operationEpoch = invalidateSessionWork();
      if (mountedRef.current) dispatch({ type: 'logout-anonymous' });
      try {
        const result = await port.signup(input);
        if (
          isSuccessful(result) &&
          mountedRef.current &&
          operationEpoch === sessionEpochRef.current
        ) {
          recoveryAttemptRef.current = 0;
          setCurrentOperationError(null);
          dispatch({ type: 'signup-authenticated' });
        }
        return result;
      } catch (error) {
        return { ok: false, failure: normalizeFailure(error) };
      }
    },
    [invalidateSessionWork, port, setCurrentOperationError],
  );

  const logout = useCallback((): Promise<void> => {
    const inFlight = logoutPromiseRef.current;
    if (inFlight && logoutEpochRef.current === sessionEpochRef.current) return inFlight;

    const logoutEpoch = invalidateSessionWork();
    logoutEpochRef.current = logoutEpoch;
    if (mountedRef.current) dispatch({ type: 'logout-anonymous' });

    let portLogout: Promise<void>;
    try {
      portLogout = port.logout();
    } catch (error) {
      portLogout = Promise.reject(error);
    }

    const promise = Promise.resolve(portLogout)
      .catch(() => {
        // Logout is fail-closed locally even when the transport is unavailable.
      })
      .then(() => {
        if (mountedRef.current && logoutEpoch === sessionEpochRef.current) {
          recoveryAttemptRef.current = 0;
          setCurrentOperationError(null);
          dispatch({ type: 'logout-anonymous' });
        }
        if (logoutPromiseRef.current === promise) logoutPromiseRef.current = null;
      });
    logoutPromiseRef.current = promise;
    return promise;
  }, [invalidateSessionWork, port, setCurrentOperationError]);

  const reportFailure = useCallback(
    (failure: AuthFailure, retry?: () => void | Promise<void>): void => {
      if (sessionRevision !== sessionRevisionRef.current || logoutPromiseRef.current) return;
      const current = authStateRef.current;
      if (failure.kind === AUTH_ERROR_KIND.UNAUTHORIZED) {
        if (current.status === AUTH_STATE.RECOVERING) return;
        if (current.status === AUTH_STATE.AUTHENTICATED) void recoverSession();
        return;
      }
      if (current.status !== AUTH_STATE.AUTHENTICATED) return;
      setCurrentOperationError({ failure, retry });
    },
    [recoverSession, sessionRevision, setCurrentOperationError],
  );

  const retryOperation = useCallback(async (): Promise<void> => {
    if (!isSessionCurrent(sessionRevision)) return;
    const current = operationErrorRef.current;
    const operationEpoch = sessionEpochRef.current;
    if (!current) return;
    setCurrentOperationError(null);
    if (!current.retry) return;
    try {
      await current.retry();
    } catch (error) {
      if (operationEpoch === sessionEpochRef.current) {
        reportFailure(normalizeFailure(error), current.retry);
      }
    }
  }, [isSessionCurrent, reportFailure, sessionRevision, setCurrentOperationError]);

  const clearOperationError = useCallback(() => {
    setCurrentOperationError(null);
  }, [setCurrentOperationError]);

  useEffect(() => {
    if (import.meta.env.MODE !== 'test' || typeof window === 'undefined') return undefined;

    const control = {
      reportFailure: (kind: AuthFailure['kind'], retryable = false) =>
        reportFailure({ kind }, retryable ? async () => undefined : undefined),
      retryBootstrap: () => runBootstrap(true),
      getRecoveryAttemptCount: () => {
        const candidate = port as AuthPort & { recoveryAttemptCount?: number };
        return candidate.recoveryAttemptCount ?? 0;
      },
      getLogoutAttemptCount: () => {
        const candidate = port as AuthPort & { logoutAttemptCount?: number };
        return candidate.logoutAttemptCount ?? 0;
      },
    };
    window.__CARELOG_TEST_AUTH_CONTROL__ = control;
    return () => {
      if (window.__CARELOG_TEST_AUTH_CONTROL__ === control) {
        delete window.__CARELOG_TEST_AUTH_CONTROL__;
      }
    };
  }, [port, reportFailure, runBootstrap]);

  const value = useMemo<AuthContextValue>(
    () => ({
      authState,
      sessionRevision,
      isSessionCurrent,
      failClosedSession,
      operationError,
      login,
      signup,
      logout,
      retryBootstrap: () => runBootstrap(true),
      reportFailure,
      retryOperation,
      clearOperationError,
    }),
    [
      authState,
      failClosedSession,
      isSessionCurrent,
      sessionRevision,
      clearOperationError,
      login,
      logout,
      operationError,
      reportFailure,
      retryOperation,
      runBootstrap,
      signup,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}

export function useAuth(): AuthContextValue {
  const context = useOptionalAuth();
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
