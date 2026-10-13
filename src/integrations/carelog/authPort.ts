import {
  AUTH_ERROR_KIND,
  type AuthBootstrapResult,
  type AuthCommandResult,
  type AuthCredentialFixture,
  type AuthFailure,
  type AuthPort,
} from '@/auth/authTypes';
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

export interface CarelogTokenPair {
  accessToken: string;
  refreshToken: string;
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

export function createCarelogAuthSessionStore(): CarelogAuthSessionStore {
  let sessionVersion = 0;
  let tokens: CarelogTokenPair | undefined;

  return {
    getAccessToken: () => tokens?.accessToken,
    getRefreshToken: () => tokens?.refreshToken,
    getSessionVersion: () => sessionVersion,
    beginSession: () => {
      sessionVersion += 1;
      tokens = undefined;
      return sessionVersion;
    },
    saveTokens: (nextTokens, expectedVersion) => {
      if (sessionVersion !== expectedVersion) return false;
      tokens = { ...nextTokens };
      return true;
    },
    invalidateSession: () => {
      const accessToken = tokens?.accessToken;
      sessionVersion += 1;
      tokens = undefined;
      return { accessToken, version: sessionVersion };
    },
    clearIfVersion: (expectedVersion) => {
      if (sessionVersion !== expectedVersion) return false;
      sessionVersion += 1;
      tokens = undefined;
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
}

/**
 * Implements the existing Carelog password-auth contract. Tokens stay in this
 * page's memory; the adapter does not infer a cookie or browser-storage policy.
 */
export function createCarelogAuthRuntime({
  apiBaseUrl,
  fetchImpl,
  sessionStore = createCarelogAuthSessionStore(),
}: CarelogAuthRuntimeOptions): CarelogAuthRuntime {
  let client: CarelogHttpClient | undefined;
  let clientError: unknown;

  try {
    if (!apiBaseUrl.trim()) {
      throw new CarelogConfigurationError('VITE_CARELOG_API_BASE_URL is required.');
    }
    if (import.meta.env.PROD && new URL(apiBaseUrl).protocol !== 'https:') {
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
      } catch {
        sessionStore.clearIfVersion(version);
        return undefined;
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
  };

  let logoutFlight: Promise<void> | undefined;

  const authPort: AuthPort = {
    async bootstrapSession(): Promise<AuthBootstrapResult> {
      if (!client) return { status: 'error', failure: failureFor(clientError) };
      if (!sessionStore.getRefreshToken()) return { status: 'anonymous' };
      const accessToken = await recoverAccessToken();
      return accessToken && sessionStore.getAccessToken() === accessToken
        ? { status: 'authenticated' }
        : { status: 'anonymous' };
    },

    async login(input: AuthCredentialFixture): Promise<AuthCommandResult> {
      const version = sessionStore.beginSession();
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
    },

    async signup(): Promise<AuthCommandResult> {
      // The inspected Carelog AuthController has no public signup endpoint.
      return { ok: false, failure: { kind: AUTH_ERROR_KIND.UNKNOWN } };
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
      const accessToken = await recoverAccessToken();
      return accessToken
        ? { ok: true }
        : { ok: false, failure: { kind: AUTH_ERROR_KIND.UNAUTHORIZED } };
    },
  };

  return { authPort, sessionProvider, sessionStore, apiBaseUrl };
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
