import {
  AUTH_ERROR_KIND,
  type AuthBootstrapResult,
  type AuthCommandResult,
  type AuthCredentialFixture,
  type AuthFailure,
  type AuthPort,
  type AuthSignupFixture,
} from '@/auth/authTypes';
import { findSignupPasswordProblem } from '@/auth/signupPolicy';
import {
  CarelogConfigurationError,
  CarelogHttpError,
  CarelogNetworkError,
  CarelogProtocolError,
} from '@/integrations/carelog/errors';
import {
  createCarelogHttpClient,
  type CarelogHttpClient,
  type CarelogSessionProvider,
} from '@/integrations/carelog/httpClient';

const LOGIN_PATH = '/api/v1/auth/login';
const LOGOUT_PATH = '/api/v1/auth/logout';
const REFRESH_PATH = '/api/v1/auth/refresh';
const REGISTRATION_PATH = '/api/v1/auth/carelog/registration';
const REGISTRATION_MAX_ATTEMPTS = 3;
const REGISTRATION_RETRY_BASE_MS = 500;
const REFRESH_TOKEN_STORAGE_KEY = 'carelog.auth.refreshToken';

export interface CarelogTokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Persists only the refresh token, and only for the lifetime of this browser
 * tab. Access tokens never leave page memory.
 */
export interface RefreshTokenVault {
  read: () => string | undefined;
  write: (refreshToken: string) => void;
  clear: () => void;
}

/**
 * sessionStorage survives a reload of the same tab and is cleared when the tab
 * closes. Every access is guarded: storage can be blocked or throw, and then
 * the session degrades to in-memory only (a reload returns to Anonymous).
 */
export function createSessionStorageRefreshTokenVault(
  storage: Storage | undefined = readSessionStorage(),
): RefreshTokenVault {
  return {
    read: () => {
      try {
        return storage?.getItem(REFRESH_TOKEN_STORAGE_KEY) ?? undefined;
      } catch {
        return undefined;
      }
    },
    write: (refreshToken) => {
      try {
        storage?.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
      } catch {
        // In-memory tokens still serve this page; only the reload restore is lost.
      }
    },
    clear: () => {
      try {
        storage?.removeItem(REFRESH_TOKEN_STORAGE_KEY);
      } catch {
        // Nothing else to clean up; the in-memory session is already cleared.
      }
    },
  };
}

function readSessionStorage(): Storage | undefined {
  try {
    return globalThis.sessionStorage;
  } catch {
    return undefined;
  }
}

export interface CarelogAuthSessionStore {
  getAccessToken: () => string | undefined;
  getRefreshToken: () => string | undefined;
  getSessionVersion: () => number;
  beginSession: () => number;
  saveTokens: (tokens: CarelogTokenPair, expectedVersion: number) => boolean;
  invalidateSession: () => { accessToken?: string; version: number };
  clearIfVersion: (expectedVersion: number) => boolean;
}

export interface CarelogAuthSessionStoreOptions {
  /** Without a vault the refresh token lives only in page memory. */
  refreshTokenVault?: RefreshTokenVault;
}

export function createCarelogAuthSessionStore({
  refreshTokenVault,
}: CarelogAuthSessionStoreOptions = {}): CarelogAuthSessionStore {
  let sessionVersion = 0;
  let tokens: CarelogTokenPair | undefined;

  // Any session boundary (new login, logout, failed recovery) drops both copies.
  const forgetTokens = () => {
    tokens = undefined;
    refreshTokenVault?.clear();
  };

  return {
    getAccessToken: () => tokens?.accessToken,
    // After a reload the page has no in-memory tokens; the vault restores the refresh token.
    getRefreshToken: () => tokens?.refreshToken ?? refreshTokenVault?.read(),
    getSessionVersion: () => sessionVersion,
    beginSession: () => {
      sessionVersion += 1;
      forgetTokens();
      return sessionVersion;
    },
    saveTokens: (nextTokens, expectedVersion) => {
      if (sessionVersion !== expectedVersion) return false;
      tokens = { ...nextTokens };
      refreshTokenVault?.write(nextTokens.refreshToken);
      return true;
    },
    invalidateSession: () => {
      const accessToken = tokens?.accessToken;
      sessionVersion += 1;
      forgetTokens();
      return { accessToken, version: sessionVersion };
    },
    clearIfVersion: (expectedVersion) => {
      if (sessionVersion !== expectedVersion) return false;
      sessionVersion += 1;
      forgetTokens();
      return true;
    },
  };
}

export interface CarelogAuthRuntime {
  authPort: AuthPort;
  sessionProvider: CarelogSessionProvider;
  sessionStore: CarelogAuthSessionStore;
  apiBaseUrl: string;
}

export interface CarelogAuthRuntimeOptions {
  apiBaseUrl: string;
  fetchImpl?: typeof fetch;
  sessionStore?: CarelogAuthSessionStore;
  /** Test seam for the registration retry backoff. */
  registrationRetryBaseMs?: number;
}

interface RegistrationPayload {
  userId: string;
  email: string;
  password: string;
  name: string;
}

/**
 * Password login plus self-service registration, over the shared Gateway.
 * Access tokens stay in page memory. The refresh token is mirrored into the
 * sessionStore's vault (sessionStorage in production) so a reload can restore
 * the session; see docs/adr/0001-carelog-session-restore.md.
 */
export function createCarelogAuthRuntime({
  apiBaseUrl,
  fetchImpl,
  sessionStore = createCarelogAuthSessionStore(),
  registrationRetryBaseMs = REGISTRATION_RETRY_BASE_MS,
}: CarelogAuthRuntimeOptions): CarelogAuthRuntime {
  let client: CarelogHttpClient | undefined;
  let clientError: unknown;

  try {
    if (!apiBaseUrl.trim()) {
      throw new CarelogConfigurationError('VITE_CARELOG_API_BASE_URL is required.');
    }
    // '/' is the same-origin edge (HTTPS by construction); only absolute bases need the check.
    if (
      import.meta.env.PROD &&
      apiBaseUrl.trim() !== '/' &&
      new URL(apiBaseUrl).protocol !== 'https:'
    ) {
      throw new CarelogConfigurationError('The production Carelog API must use HTTPS.');
    }
    client = createCarelogHttpClient({
      baseUrl: apiBaseUrl,
      fetchImpl,
      sessionProvider: { credentials: 'omit' },
    });
  } catch (error) {
    clientError = error;
  }

  const requireClient = (): CarelogHttpClient => {
    if (client) return client;
    if (clientError instanceof Error) throw clientError;
    throw new CarelogConfigurationError('The Carelog Auth API is unavailable.');
  };

  let refreshFlight: { version: number; promise: Promise<string | undefined> } | undefined;

  const recoverAccessToken = (): Promise<string | undefined> => {
    const version = sessionStore.getSessionVersion();
    const refreshToken = sessionStore.getRefreshToken();
    if (!refreshToken) return Promise.resolve(undefined);
    if (refreshFlight?.version === version) return refreshFlight.promise;

    const promise = (async () => {
      try {
        const payload = await requireClient().post<unknown>(REFRESH_PATH, { refreshToken });
        const tokens = readTokenPair(payload);
        return sessionStore.saveTokens(tokens, version) ? tokens.accessToken : undefined;
      } catch (error) {
        // The refresh contract rejects a terminal refresh credential with
        // either 401 (invalid/expired) or 404 (absent from the session store).
        // Other failures stay distinguishable so callers do not turn a
        // temporary server or network problem into a logout.
        if (error instanceof CarelogHttpError && (error.status === 401 || error.status === 404)) {
          return undefined;
        }
        throw error;
      }
    })().finally(() => {
      if (refreshFlight?.promise === promise) refreshFlight = undefined;
    });
    refreshFlight = { version, promise };
    return promise;
  };

  const sessionProvider: CarelogSessionProvider = {
    credentials: 'omit',
    getAccessToken: sessionStore.getAccessToken,
    getSessionVersion: sessionStore.getSessionVersion,
    recoverAccessToken,
    invalidateSessionIfVersion: sessionStore.clearIfVersion,
  };

  let logoutFlight: Promise<void> | undefined;
  let pendingLoginVersion: number | undefined;

  const cancelPendingLogin = (): void => {
    const version = pendingLoginVersion;
    pendingLoginVersion = undefined;
    if (version !== undefined) sessionStore.clearIfVersion(version);
  };

  // Same payload retried from the form reuses its key, so the server replays the
  // original outcome instead of answering 409 to the user's own retry. In memory only.
  let pendingRegistration: { payload: RegistrationPayload; key: string } | undefined;

  const passwordLogin = async (input: AuthCredentialFixture): Promise<AuthCommandResult> => {
    const version = sessionStore.beginSession();
    pendingLoginVersion = version;
    try {
      if (logoutFlight) await logoutFlight.catch(() => undefined);
      if (sessionStore.getSessionVersion() !== version) {
        return { ok: false, failure: { kind: AUTH_ERROR_KIND.UNKNOWN } };
      }
      try {
        // Carelog's existing DTO names these product-form values userId/password.
        const payload = await requireClient().post<unknown>(LOGIN_PATH, {
          userId: input.account,
          password: input.secret,
        });
        const tokens = readTokenPair(payload);
        if (!sessionStore.saveTokens(tokens, version)) {
          return { ok: false, failure: { kind: AUTH_ERROR_KIND.UNKNOWN } };
        }
        return { ok: true };
      } catch (error) {
        return { ok: false, failure: failureFor(error) };
      }
    } finally {
      if (pendingLoginVersion === version) pendingLoginVersion = undefined;
    }
  };

  const registrationKeyFor = (payload: RegistrationPayload): string => {
    const pending = pendingRegistration;
    if (
      pending &&
      pending.payload.userId === payload.userId &&
      pending.payload.email === payload.email &&
      pending.payload.password === payload.password &&
      pending.payload.name === payload.name
    ) {
      return pending.key;
    }
    const key = createIdempotencyKey();
    pendingRegistration = { payload, key };
    return key;
  };

  const registerAccount = async (payload: RegistrationPayload): Promise<void> => {
    const key = registrationKeyFor(payload);
    for (let attempt = 1; ; attempt += 1) {
      try {
        // Core answers 201 with a message-only envelope (no `data` member).
        await requireClient().post<void>(REGISTRATION_PATH, payload, {
          headers: { 'Idempotency-Key': key },
          withoutData: true,
        });
        pendingRegistration = undefined;
        return;
      } catch (error) {
        if (!isRetryableRegistrationError(error) || attempt >= REGISTRATION_MAX_ATTEMPTS) {
          // 400/409 are terminal for this key; a fresh form value needs a fresh key.
          if (error instanceof CarelogHttpError && (error.status === 400 || error.status === 409)) {
            pendingRegistration = undefined;
          }
          throw error;
        }
        await wait(registrationRetryBaseMs * attempt);
      }
    }
  };

  const authPort: AuthPort = {
    async bootstrapSession(): Promise<AuthBootstrapResult> {
      if (!client) return { status: 'error', failure: failureFor(clientError) };
      if (!sessionStore.getRefreshToken()) return { status: 'anonymous' };
      const version = sessionStore.getSessionVersion();
      let accessToken: string | undefined;
      try {
        accessToken = await recoverAccessToken();
      } catch (error) {
        return { status: 'error', failure: failureFor(error) };
      }
      if (
        accessToken &&
        sessionStore.getSessionVersion() === version &&
        sessionStore.getAccessToken() === accessToken
      ) {
        return { status: 'authenticated' };
      }
      sessionStore.clearIfVersion(version);
      return { status: 'anonymous' };
    },

    login: passwordLogin,

    cancelPendingLogin,

    async signup(input: AuthSignupFixture): Promise<AuthCommandResult> {
      const payload: RegistrationPayload = {
        userId: input.account.trim(),
        email: input.email.trim(),
        password: input.secret,
        name: input.name.trim(),
      };
      if (findSignupPasswordProblem(payload.password)) {
        // Fail closed locally; Core would answer 400 for the same input.
        return {
          ok: false,
          failure: { kind: AUTH_ERROR_KIND.UNKNOWN, reason: 'invalid-registration' },
        };
      }
      try {
        await registerAccount(payload);
      } catch (error) {
        return { ok: false, failure: registrationFailureFor(error) };
      }
      // Registration returns no tokens. Obtain the session through the same
      // password login the form uses, so the restore path is identical.
      const session = await passwordLogin({ account: payload.userId, secret: payload.password });
      if (session.ok) return session;
      return {
        ok: false,
        failure: { kind: AUTH_ERROR_KIND.UNKNOWN, reason: 'registered-login-required' },
      };
    },

    async logout(): Promise<void> {
      const { accessToken } = sessionStore.invalidateSession();
      if (logoutFlight) return logoutFlight;
      if (!accessToken) return;

      const promise = (async () => {
        const logoutClient = createCarelogHttpClient({
          baseUrl: apiBaseUrl,
          fetchImpl,
          sessionProvider: {
            credentials: 'omit',
            getAccessToken: () => accessToken,
          },
        });
        await logoutClient.post<void>(LOGOUT_PATH);
      })().finally(() => {
        if (logoutFlight === promise) logoutFlight = undefined;
      });
      logoutFlight = promise;
      return promise;
    },

    async recoverSession(): Promise<AuthCommandResult> {
      const version = sessionStore.getSessionVersion();
      let accessToken: string | undefined;
      try {
        accessToken = await recoverAccessToken();
      } catch (error) {
        return { ok: false, failure: failureFor(error) };
      }
      if (
        accessToken &&
        sessionStore.getSessionVersion() === version &&
        sessionStore.getAccessToken() === accessToken
      ) {
        return { ok: true };
      }
      sessionStore.clearIfVersion(version);
      return { ok: false, failure: { kind: AUTH_ERROR_KIND.UNAUTHORIZED } };
    },
  };

  return { authPort, sessionProvider, sessionStore, apiBaseUrl };
}

function isRetryableRegistrationError(error: unknown): boolean {
  // 503 is Core's PENDING (or a transient failure). The same key makes a retry safe.
  if (error instanceof CarelogNetworkError) return true;
  return error instanceof CarelogHttpError && error.status === 503;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function registrationFailureFor(error: unknown): AuthFailure {
  // Retryable errors reach this point only after the retry loop gave up.
  if (isRetryableRegistrationError(error)) {
    return { ...failureFor(error), reason: 'registration-retry-exhausted' };
  }
  if (error instanceof CarelogHttpError) {
    if (error.status === 409) return { kind: AUTH_ERROR_KIND.UNKNOWN, reason: 'account-conflict' };
    if (error.status === 400)
      return { kind: AUTH_ERROR_KIND.UNKNOWN, reason: 'invalid-registration' };
  }
  return failureFor(error);
}

function createIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') return cryptoApi.randomUUID();
  // randomUUID needs a secure context; fall back to random bytes in plain-HTTP dev.
  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function readTokenPair(payload: unknown): CarelogTokenPair {
  if (!payload || typeof payload !== 'object') {
    throw new CarelogProtocolError('The Carelog Auth token response is invalid.', payload);
  }
  const candidate = payload as Record<string, unknown>;
  if (
    typeof candidate.accessToken !== 'string' ||
    !candidate.accessToken.trim() ||
    typeof candidate.refreshToken !== 'string' ||
    !candidate.refreshToken.trim()
  ) {
    throw new CarelogProtocolError('The Carelog Auth token response is invalid.', payload);
  }
  return { accessToken: candidate.accessToken, refreshToken: candidate.refreshToken };
}

function failureFor(error: unknown): AuthFailure {
  if (error instanceof CarelogHttpError) {
    if (error.status === 401) return { kind: AUTH_ERROR_KIND.UNAUTHORIZED };
    if (error.status === 403) return { kind: AUTH_ERROR_KIND.FORBIDDEN };
    if (error.status >= 500) return { kind: AUTH_ERROR_KIND.SERVER };
    return { kind: AUTH_ERROR_KIND.UNKNOWN };
  }
  if (error instanceof CarelogNetworkError) return { kind: AUTH_ERROR_KIND.NETWORK };
  if (error instanceof CarelogConfigurationError) return { kind: AUTH_ERROR_KIND.UNKNOWN };
  if (error instanceof CarelogProtocolError) return { kind: AUTH_ERROR_KIND.UNKNOWN };
  return { kind: AUTH_ERROR_KIND.UNKNOWN };
}
