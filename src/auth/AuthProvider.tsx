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

import { createInMemoryAuthPort } from '@/auth/inMemoryAuthAdapter';
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

export interface AuthOperationError {
  failure: AuthFailure;
  retry?: () => void | Promise<void>;
}

export interface AuthContextValue {
  authState: AuthState;
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
  const [port] = useState<AuthPort>(() => authPort ?? createInMemoryAuthPort());
  const [authState, dispatch] = useReducer(authStateReducer, INITIAL_AUTH_STATE);
  const [operationError, setOperationError] = useState<AuthOperationError | null>(null);
  const authStateRef = useRef(authState);
  const recoveryAttemptRef = useRef(0);
  const recoveryInFlightRef = useRef(false);
  const sessionEpochRef = useRef(0);
  const bootstrapPromiseRef = useRef<Promise<void> | null>(null);
  const operationErrorRef = useRef<AuthOperationError | null>(null);

  useEffect(() => {
    authStateRef.current = authState;
    operationErrorRef.current = operationError;
  }, [authState, operationError]);

  const setCurrentOperationError = useCallback((next: AuthOperationError | null) => {
    operationErrorRef.current = next;
    setOperationError(next);
  }, []);

  const recoverSession = useCallback(async (): Promise<boolean> => {
    if (recoveryInFlightRef.current) return true;
    if (recoveryAttemptRef.current >= 1) {
      dispatch({ type: 'recovery-anonymous' });
      return false;
    }

    recoveryAttemptRef.current += 1;
    recoveryInFlightRef.current = true;
    const recoveryEpoch = sessionEpochRef.current;
    dispatch({ type: 'recovery-start', attempt: recoveryAttemptRef.current });
    setCurrentOperationError(null);

    try {
      const result = await port.recoverSession();
      if (recoveryEpoch !== sessionEpochRef.current) return false;
      if (isSuccessful(result)) {
        dispatch({ type: 'recovery-authenticated' });
        return true;
      }
    } catch {
      // A failed recovery has the same safe product outcome as an explicit
      // rejected recovery: the user returns to Auth Entry.
    } finally {
      recoveryInFlightRef.current = false;
    }

    dispatch({ type: 'recovery-anonymous' });
    return false;
  }, [port, setCurrentOperationError]);

  const applyBootstrapResult = useCallback(
    async (result: AuthBootstrapResult): Promise<void> => {
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
        bootstrapPromiseRef.current = null;
        recoveryAttemptRef.current = 0;
      }

      dispatch({ type: 'bootstrap-start' });
      const promise = (async () => {
        try {
          const result = await port.bootstrapSession();
          await applyBootstrapResult(result);
        } catch (error) {
          dispatch({ type: 'bootstrap-error', error: normalizeFailure(error) });
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
    [applyBootstrapResult, port],
  );

  useEffect(() => {
    runBootstrap();
  }, [runBootstrap]);

  const login = useCallback(
    async (input: AuthCredentialFixture): Promise<AuthCommandResult> => {
      try {
        const result = await port.login(input);
        if (isSuccessful(result)) {
          sessionEpochRef.current += 1;
          recoveryAttemptRef.current = 0;
          setCurrentOperationError(null);
          dispatch({ type: 'login-authenticated' });
        }
        return result;
      } catch (error) {
        return { ok: false, failure: normalizeFailure(error) };
      }
    },
    [port, setCurrentOperationError],
  );

  const signup = useCallback(
    async (input: AuthSignupFixture): Promise<AuthCommandResult> => {
      try {
        const result = await port.signup(input);
        if (isSuccessful(result)) {
          sessionEpochRef.current += 1;
          recoveryAttemptRef.current = 0;
          setCurrentOperationError(null);
          dispatch({ type: 'signup-authenticated' });
        }
        return result;
      } catch (error) {
        return { ok: false, failure: normalizeFailure(error) };
      }
    },
    [port, setCurrentOperationError],
  );

  const logout = useCallback(async (): Promise<void> => {
    sessionEpochRef.current += 1;
    try {
      await port.logout();
    } finally {
      recoveryAttemptRef.current = 0;
      setCurrentOperationError(null);
      dispatch({ type: 'logout-anonymous' });
    }
  }, [port, setCurrentOperationError]);

  const reportFailure = useCallback(
    (failure: AuthFailure, retry?: () => void | Promise<void>): void => {
      const current = authStateRef.current;
      if (failure.kind === AUTH_ERROR_KIND.UNAUTHORIZED) {
        if (current.status === AUTH_STATE.RECOVERING) return;
        if (current.status === AUTH_STATE.AUTHENTICATED) void recoverSession();
        return;
      }
      if (current.status !== AUTH_STATE.AUTHENTICATED) return;
      setCurrentOperationError({ failure, retry });
    },
    [recoverSession, setCurrentOperationError],
  );

  const retryOperation = useCallback(async (): Promise<void> => {
    const current = operationErrorRef.current;
    if (!current) return;
    setCurrentOperationError(null);
    if (!current.retry) return;
    try {
      await current.retry();
    } catch (error) {
      reportFailure(normalizeFailure(error), current.retry);
    }
  }, [reportFailure, setCurrentOperationError]);

  const clearOperationError = useCallback(() => {
    setCurrentOperationError(null);
  }, [setCurrentOperationError]);

  const value = useMemo<AuthContextValue>(
    () => ({
      authState,
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
