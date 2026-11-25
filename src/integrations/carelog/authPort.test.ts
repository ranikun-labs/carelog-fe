import { afterEach, describe, expect, it, vi } from 'vitest';

import { AUTH_ERROR_KIND } from '@/auth/authTypes';
import {
  createCarelogAuthRuntime,
  createCarelogAuthSessionStore,
  createSessionStorageRefreshTokenVault,
} from '@/integrations/carelog/authPort';
import { createCarelogHttpClient } from '@/integrations/carelog/httpClient';

function response(status: number, data?: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify({ status, message: 'ok', data }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function runtimeWith(fetchImpl: typeof fetch, sessionStore = createCarelogAuthSessionStore()) {
  return createCarelogAuthRuntime({
    apiBaseUrl: 'https://gateway.example.test',
    fetchImpl,
    sessionStore,
  });
}

function setTokens(
  sessionStore: ReturnType<typeof createCarelogAuthSessionStore>,
  accessToken: string,
  refreshToken: string,
) {
  const version = sessionStore.beginSession();
  expect(sessionStore.saveTokens({ accessToken, refreshToken }, version)).toBe(true);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe('Carelog Production AuthPort', () => {
  it('maps account/secret to userId/password and keeps returned tokens in page memory', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response(200, { accessToken: 'access-one', refreshToken: 'refresh-one' }));
    const runtime = runtimeWith(fetchImpl);

    await expect(
      runtime.authPort.login({ account: 'therapist-7', secret: 'secret-value' }),
    ).resolves.toEqual({ ok: true });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://gateway.example.test/api/v1/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'therapist-7', password: 'secret-value' }),
      }),
    );
    expect(runtime.sessionProvider.getAccessToken?.()).toBe('access-one');
    expect(runtime.sessionStore.getRefreshToken()).toBe('refresh-one');
    expect(String(fetchImpl.mock.calls[0]?.[0])).not.toContain('secret-value');
  });

  it.each([
    [401, AUTH_ERROR_KIND.UNAUTHORIZED],
    [403, AUTH_ERROR_KIND.FORBIDDEN],
    [404, AUTH_ERROR_KIND.UNKNOWN],
    [500, AUTH_ERROR_KIND.SERVER],
  ] as const)('maps HTTP %s login failures without creating a session', async (status, kind) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(status, null));
    const runtime = runtimeWith(fetchImpl);

    await expect(runtime.authPort.login({ account: 'therapist', secret: 'bad' })).resolves.toEqual({
      ok: false,
      failure: { kind },
    });
    expect(runtime.sessionProvider.getAccessToken?.()).toBeUndefined();
    expect(runtime.sessionStore.getRefreshToken()).toBeUndefined();
  });

  it('classifies network failures and never treats them as login success', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'));
    const runtime = runtimeWith(fetchImpl);

    await expect(
      runtime.authPort.login({ account: 'therapist', secret: 'secret' }),
    ).resolves.toEqual({
      ok: false,
      failure: { kind: AUTH_ERROR_KIND.NETWORK },
    });
    expect(runtime.sessionProvider.getAccessToken?.()).toBeUndefined();
  });

  it('bootstraps by refreshing the in-memory refresh token and stores the rotated pair', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response(200, { accessToken: 'access-two', refreshToken: 'refresh-two' }));
    const sessionStore = createCarelogAuthSessionStore();
    setTokens(sessionStore, 'access-one', 'refresh-one');
    const runtime = runtimeWith(fetchImpl, sessionStore);

    await expect(runtime.authPort.bootstrapSession()).resolves.toEqual({ status: 'authenticated' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://gateway.example.test/api/v1/auth/refresh',
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'refresh-one' }),
      }),
    );
    expect(runtime.sessionProvider.getAccessToken?.()).toBe('access-two');
    expect(sessionStore.getRefreshToken()).toBe('refresh-two');
  });

  it.each([401, 404] as const)(
    'transitions safely to anonymous and clears tokens after refresh HTTP %s',
    async (status) => {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(status, null));
      const sessionStore = createCarelogAuthSessionStore();
      setTokens(sessionStore, 'expired-access', 'revoked-refresh');
      const runtime = runtimeWith(fetchImpl, sessionStore);

      await expect(runtime.authPort.bootstrapSession()).resolves.toEqual({ status: 'anonymous' });
      expect(runtime.sessionProvider.getAccessToken?.()).toBeUndefined();
      expect(sessionStore.getRefreshToken()).toBeUndefined();
    },
  );

  it.each([401, 404] as const)(
    'reports refresh HTTP %s as unauthorized during recovery and clears it',
    async (status) => {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(status, null));
      const sessionStore = createCarelogAuthSessionStore();
      setTokens(sessionStore, 'expired-access', 'revoked-refresh');
      const runtime = runtimeWith(fetchImpl, sessionStore);

      await expect(runtime.authPort.recoverSession()).resolves.toEqual({
        ok: false,
        failure: { kind: AUTH_ERROR_KIND.UNAUTHORIZED },
      });
      expect(runtime.sessionStore.getAccessToken()).toBeUndefined();
      expect(runtime.sessionStore.getRefreshToken()).toBeUndefined();
    },
  );

  it.each([
    [403, AUTH_ERROR_KIND.FORBIDDEN],
    [500, AUTH_ERROR_KIND.SERVER],
  ] as const)(
    'keeps the stored session and reports HTTP %s during bootstrap refresh',
    async (status, kind) => {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(status, null));
      const sessionStore = createCarelogAuthSessionStore();
      setTokens(sessionStore, 'access-one', 'refresh-one');
      const runtime = runtimeWith(fetchImpl, sessionStore);

      await expect(runtime.authPort.bootstrapSession()).resolves.toEqual({
        status: 'error',
        failure: { kind },
      });
      expect(runtime.sessionStore.getAccessToken()).toBe('access-one');
      expect(runtime.sessionStore.getRefreshToken()).toBe('refresh-one');
    },
  );

  it('keeps the stored session and reports a network failure during bootstrap refresh', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'));
    const sessionStore = createCarelogAuthSessionStore();
    setTokens(sessionStore, 'access-one', 'refresh-one');
    const runtime = runtimeWith(fetchImpl, sessionStore);

    await expect(runtime.authPort.bootstrapSession()).resolves.toEqual({
      status: 'error',
      failure: { kind: AUTH_ERROR_KIND.NETWORK },
    });
    expect(runtime.sessionStore.getRefreshToken()).toBe('refresh-one');
  });

  it.each([
    [403, AUTH_ERROR_KIND.FORBIDDEN],
    [500, AUTH_ERROR_KIND.SERVER],
  ] as const)(
    'keeps the session and reports HTTP %s during product-request recovery',
    async (status, kind) => {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(status, null));
      const sessionStore = createCarelogAuthSessionStore();
      setTokens(sessionStore, 'access-one', 'refresh-one');
      const runtime = runtimeWith(fetchImpl, sessionStore);

      await expect(runtime.authPort.recoverSession()).resolves.toEqual({
        ok: false,
        failure: { kind },
      });
      expect(runtime.sessionStore.getAccessToken()).toBe('access-one');
      expect(runtime.sessionStore.getRefreshToken()).toBe('refresh-one');
    },
  );

  it('keeps the session and reports a network failure during product-request recovery', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'));
    const sessionStore = createCarelogAuthSessionStore();
    setTokens(sessionStore, 'access-one', 'refresh-one');
    const runtime = runtimeWith(fetchImpl, sessionStore);

    await expect(runtime.authPort.recoverSession()).resolves.toEqual({
      ok: false,
      failure: { kind: AUTH_ERROR_KIND.NETWORK },
    });
    expect(runtime.sessionStore.getRefreshToken()).toBe('refresh-one');
  });

  it('logs out with the captured bearer, then clears local session state before the request settles', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(204));
    const sessionStore = createCarelogAuthSessionStore();
    setTokens(sessionStore, 'access-to-revoke', 'refresh-to-revoke');
    const runtime = runtimeWith(fetchImpl, sessionStore);

    const logout = runtime.authPort.logout();
    expect(runtime.sessionProvider.getAccessToken?.()).toBeUndefined();
    await logout;

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://gateway.example.test/api/v1/auth/logout',
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        headers: { Accept: 'application/json', Authorization: 'Bearer access-to-revoke' },
      }),
    );
    expect(runtime.sessionStore.getRefreshToken()).toBeUndefined();
  });

  it('fails closed when logout cannot reach the API', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline'));
    const sessionStore = createCarelogAuthSessionStore();
    setTokens(sessionStore, 'access-one', 'refresh-one');
    const runtime = runtimeWith(fetchImpl, sessionStore);

    await expect(runtime.authPort.logout()).rejects.toMatchObject({ name: 'CarelogNetworkError' });
    expect(runtime.sessionProvider.getAccessToken?.()).toBeUndefined();
    expect(sessionStore.getRefreshToken()).toBeUndefined();
  });

  it('coalesces concurrent product 401s into one token rotation and retries with the new bearer', async () => {
    const refreshResponse = deferred<Response>();
    let refreshRequests = 0;
    const resourceBearers: Array<string | undefined> = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/refresh')) {
        refreshRequests += 1;
        return refreshResponse.promise;
      }
      resourceBearers.push((init?.headers as Record<string, string>).Authorization);
      return resourceBearers.at(-1) === 'Bearer access-two'
        ? response(200, [{ id: 'loaded' }])
        : response(401, null);
    });
    const sessionStore = createCarelogAuthSessionStore();
    setTokens(sessionStore, 'access-one', 'refresh-one');
    const runtime = runtimeWith(fetchImpl, sessionStore);
    const onUnauthorized = vi.fn();
    const productClient = createCarelogHttpClient({
      baseUrl: runtime.apiBaseUrl,
      fetchImpl,
      sessionProvider: runtime.sessionProvider,
      onUnauthorized,
    });

    const first = productClient.get('/api/v1/private');
    const second = productClient.get('/api/v1/private');
    await vi.waitFor(() => expect(refreshRequests).toBe(1));
    refreshResponse.resolve(
      response(200, { accessToken: 'access-two', refreshToken: 'refresh-two' }),
    );

    await expect(Promise.all([first, second])).resolves.toEqual([
      [{ id: 'loaded' }],
      [{ id: 'loaded' }],
    ]);
    expect(refreshRequests).toBe(1);
    expect(resourceBearers).toEqual([
      'Bearer access-one',
      'Bearer access-one',
      'Bearer access-two',
      'Bearer access-two',
    ]);
    expect(onUnauthorized).toHaveBeenCalledTimes(2);
    expect(runtime.sessionStore.getRefreshToken()).toBe('refresh-two');
  });

  it('clears a stale session when the refresh token is absent from the server store', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      return String(input).endsWith('/api/v1/auth/refresh')
        ? response(404, null)
        : response(401, null);
    });
    const sessionStore = createCarelogAuthSessionStore();
    setTokens(sessionStore, 'expired-access', 'missing-refresh');
    const runtime = runtimeWith(fetchImpl, sessionStore);
    const onTerminalUnauthorized = vi.fn();
    const client = createCarelogHttpClient({
      baseUrl: runtime.apiBaseUrl,
      fetchImpl,
      sessionProvider: runtime.sessionProvider,
      onTerminalUnauthorized,
    });

    await expect(client.get('/api/v1/private')).rejects.toMatchObject({ name: 'AbortError' });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sessionStore.getAccessToken()).toBeUndefined();
    expect(sessionStore.getRefreshToken()).toBeUndefined();
    expect(onTerminalUnauthorized).toHaveBeenCalledOnce();
  });

  it('invalidates tokens after a refreshed product retry receives terminal 401', async () => {
    const requests: Array<{ url: string; authorization?: string; body?: string }> = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const headers = init?.headers as Record<string, string> | undefined;
      requests.push({
        url: String(input),
        authorization: headers?.Authorization,
        body: typeof init?.body === 'string' ? init.body : undefined,
      });
      if (String(input).endsWith('/api/v1/auth/refresh')) {
        return response(200, { accessToken: 'access-two', refreshToken: 'refresh-two' });
      }
      return response(401, null);
    });
    const sessionStore = createCarelogAuthSessionStore();
    setTokens(sessionStore, 'access-one', 'refresh-one');
    const runtime = runtimeWith(fetchImpl, sessionStore);
    const onUnauthorized = vi.fn();
    const onTerminalUnauthorized = vi.fn();
    const client = createCarelogHttpClient({
      baseUrl: runtime.apiBaseUrl,
      fetchImpl,
      sessionProvider: runtime.sessionProvider,
      onUnauthorized,
      onTerminalUnauthorized,
    });

    await expect(
      client.post('/api/v1/private', { note: 'Synthetic A payload' }),
    ).rejects.toMatchObject({
      name: 'AbortError',
    });

    expect(requests).toHaveLength(3);
    expect(requests[0]).toMatchObject({
      url: 'https://gateway.example.test/api/v1/private',
      authorization: 'Bearer access-one',
      body: JSON.stringify({ note: 'Synthetic A payload' }),
    });
    expect(requests[1]).toMatchObject({
      url: 'https://gateway.example.test/api/v1/auth/refresh',
      body: JSON.stringify({ refreshToken: 'refresh-one' }),
    });
    expect(requests[2]).toMatchObject({
      url: 'https://gateway.example.test/api/v1/private',
      authorization: 'Bearer access-two',
      body: JSON.stringify({ note: 'Synthetic A payload' }),
    });
    expect(onUnauthorized).toHaveBeenCalledOnce();
    expect(onTerminalUnauthorized).toHaveBeenCalledOnce();
    expect(runtime.sessionStore.getAccessToken()).toBeUndefined();
    expect(runtime.sessionStore.getRefreshToken()).toBeUndefined();
  });

  it('coalesces concurrent retries and expires the session once when both retries return 401', async () => {
    const refreshResponse = deferred<Response>();
    let refreshRequests = 0;
    let productRequests = 0;
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      if (String(input).endsWith('/api/v1/auth/refresh')) {
        refreshRequests += 1;
        return refreshResponse.promise;
      }
      productRequests += 1;
      return response(401, null);
    });
    const sessionStore = createCarelogAuthSessionStore();
    setTokens(sessionStore, 'access-one', 'refresh-one');
    const runtime = runtimeWith(fetchImpl, sessionStore);
    const onTerminalUnauthorized = vi.fn();
    const client = createCarelogHttpClient({
      baseUrl: runtime.apiBaseUrl,
      fetchImpl,
      sessionProvider: runtime.sessionProvider,
      onTerminalUnauthorized,
    });

    const requests = [client.get('/api/v1/private'), client.get('/api/v1/private')];
    await vi.waitFor(() => expect(refreshRequests).toBe(1));
    refreshResponse.resolve(
      response(200, { accessToken: 'access-two', refreshToken: 'refresh-two' }),
    );
    const results = await Promise.allSettled(requests);

    expect(refreshRequests).toBe(1);
    expect(productRequests).toBe(4);
    expect(results.every((result) => result.status === 'rejected')).toBe(true);
    expect(onTerminalUnauthorized).toHaveBeenCalledOnce();
    expect(sessionStore.getAccessToken()).toBeUndefined();
    expect(sessionStore.getRefreshToken()).toBeUndefined();
  });

  it('does not replay an old product request if logout wins while refresh is pending', async () => {
    const refreshResponse = deferred<Response>();
    const resourceBearers: Array<string | undefined> = [];
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/api/v1/auth/refresh')) return refreshResponse.promise;
      if (url.endsWith('/api/v1/auth/logout')) return response(204);
      resourceBearers.push((init?.headers as Record<string, string>).Authorization);
      return response(401, null);
    });
    const sessionStore = createCarelogAuthSessionStore();
    setTokens(sessionStore, 'access-one', 'refresh-one');
    const runtime = runtimeWith(fetchImpl, sessionStore);
    const productClient = createCarelogHttpClient({
      baseUrl: runtime.apiBaseUrl,
      fetchImpl,
      sessionProvider: runtime.sessionProvider,
    });

    const pendingRequest = productClient.get('/api/v1/private');
    await vi.waitFor(() =>
      expect(String(fetchImpl.mock.calls.at(-1)?.[0])).toContain('/auth/refresh'),
    );
    await runtime.authPort.logout();
    refreshResponse.resolve(
      response(200, { accessToken: 'stale-access', refreshToken: 'stale-refresh' }),
    );

    await expect(pendingRequest).rejects.toMatchObject({ name: 'AbortError' });
    expect(resourceBearers).toEqual(['Bearer access-one']);
    expect(runtime.sessionProvider.getAccessToken?.()).toBeUndefined();
    expect(runtime.sessionStore.getRefreshToken()).toBeUndefined();
  });
});

const SIGNUP_INPUT = {
  account: 'therapist-9',
  secret: 'secret-value',
  name: '김치료',
  email: 'therapist-9@example.test',
};

/** Core's registration envelope has no `data` member, so the response is message-only. */
function registrationResponse(status: number): Response {
  return new Response(JSON.stringify({ status, message: 'Registration completed.' }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function registrationError(status: number): Response {
  return new Response(JSON.stringify({ status, message: 'error' }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function memoryVault(initial?: string) {
  let stored = initial;
  return {
    read: vi.fn(() => stored),
    write: vi.fn((token: string) => {
      stored = token;
    }),
    clear: vi.fn(() => {
      stored = undefined;
    }),
    peek: () => stored,
  };
}

function signupRuntime(fetchImpl: typeof fetch) {
  return createCarelogAuthRuntime({
    apiBaseUrl: 'https://gateway.example.test',
    fetchImpl,
    registrationRetryBaseMs: 0,
  });
}

describe('Carelog signup through the shared Gateway', () => {
  it('registers via Core with one Idempotency-Key, then signs in with the password', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(registrationResponse(201))
      .mockResolvedValueOnce(
        response(200, { accessToken: 'access-new', refreshToken: 'refresh-new' }),
      );
    const runtime = signupRuntime(fetchImpl);

    await expect(runtime.authPort.signup(SIGNUP_INPUT)).resolves.toEqual({ ok: true });

    const [registrationUrl, registration] = fetchImpl.mock.calls[0];
    expect(registrationUrl).toBe('https://gateway.example.test/api/v1/auth/carelog/registration');
    expect(registration).toMatchObject({ method: 'POST', credentials: 'omit' });
    const headers = registration?.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(headers['Idempotency-Key']).not.toContain(',');
    expect(headers.Authorization).toBeUndefined();
    expect(JSON.parse(registration?.body as string)).toEqual({
      userId: 'therapist-9',
      email: 'therapist-9@example.test',
      password: 'secret-value',
      name: '김치료',
    });
    expect(fetchImpl.mock.calls[1][0]).toBe('https://gateway.example.test/api/v1/auth/login');
    expect(runtime.sessionStore.getAccessToken()).toBe('access-new');
  });

  it('retries a PENDING 503 with the same key and the same body', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(registrationError(503))
      .mockResolvedValueOnce(registrationError(503))
      .mockResolvedValueOnce(registrationResponse(201))
      .mockResolvedValueOnce(response(200, { accessToken: 'a', refreshToken: 'r' }));
    const runtime = signupRuntime(fetchImpl);

    await expect(runtime.authPort.signup(SIGNUP_INPUT)).resolves.toEqual({ ok: true });

    const keys = fetchImpl.mock.calls
      .slice(0, 3)
      .map(([, init]) => (init?.headers as Record<string, string>)['Idempotency-Key']);
    expect(new Set(keys).size).toBe(1);
    const bodies = fetchImpl.mock.calls.slice(0, 3).map(([, init]) => init?.body);
    expect(new Set(bodies).size).toBe(1);
  });

  it('reuses the key when the user resubmits after retries are exhausted', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(registrationError(503))
      .mockResolvedValueOnce(registrationError(503))
      .mockResolvedValueOnce(registrationError(503))
      .mockResolvedValueOnce(registrationResponse(201))
      .mockResolvedValueOnce(response(200, { accessToken: 'a', refreshToken: 'r' }));
    const runtime = signupRuntime(fetchImpl);

    await expect(runtime.authPort.signup(SIGNUP_INPUT)).resolves.toMatchObject({
      ok: false,
      failure: { kind: AUTH_ERROR_KIND.SERVER },
    });
    await expect(runtime.authPort.signup(SIGNUP_INPUT)).resolves.toEqual({ ok: true });

    const keys = fetchImpl.mock.calls
      .slice(0, 4)
      .map(([, init]) => (init?.headers as Record<string, string>)['Idempotency-Key']);
    expect(new Set(keys).size).toBe(1);
  });

  it('uses a fresh key once the form values change', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(registrationError(409))
      .mockResolvedValueOnce(registrationResponse(201))
      .mockResolvedValueOnce(response(200, { accessToken: 'a', refreshToken: 'r' }));
    const runtime = signupRuntime(fetchImpl);

    await runtime.authPort.signup(SIGNUP_INPUT);
    await runtime.authPort.signup({ ...SIGNUP_INPUT, account: 'therapist-10' });

    const first = (fetchImpl.mock.calls[0][1]?.headers as Record<string, string>)[
      'Idempotency-Key'
    ];
    const second = (fetchImpl.mock.calls[1][1]?.headers as Record<string, string>)[
      'Idempotency-Key'
    ];
    expect(second).not.toBe(first);
  });

  it('maps 409 to an account-conflict reason without attempting login', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(registrationError(409));
    const runtime = signupRuntime(fetchImpl);

    await expect(runtime.authPort.signup(SIGNUP_INPUT)).resolves.toEqual({
      ok: false,
      failure: { kind: AUTH_ERROR_KIND.UNKNOWN, reason: 'account-conflict' },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('maps 400 to an invalid-registration reason', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(registrationError(400));
    const runtime = signupRuntime(fetchImpl);

    await expect(runtime.authPort.signup(SIGNUP_INPUT)).resolves.toEqual({
      ok: false,
      failure: { kind: AUTH_ERROR_KIND.UNKNOWN, reason: 'invalid-registration' },
    });
  });

  it('reports a created account whose sign-in fails as a distinct, non-credential failure', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(registrationResponse(201))
      .mockResolvedValueOnce(registrationError(401));
    const runtime = signupRuntime(fetchImpl);

    await expect(runtime.authPort.signup(SIGNUP_INPUT)).resolves.toEqual({
      ok: false,
      failure: { kind: AUTH_ERROR_KIND.UNKNOWN, reason: 'registered-login-required' },
    });
    expect(runtime.sessionStore.getAccessToken()).toBeUndefined();
  });

  it('rejects a registration that claims success without the status it returned', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
      new Response(JSON.stringify({ status: 200, message: 'ok' }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const runtime = signupRuntime(fetchImpl);

    await expect(runtime.authPort.signup(SIGNUP_INPUT)).resolves.toEqual({
      ok: false,
      failure: { kind: AUTH_ERROR_KIND.UNKNOWN },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('Carelog session restore across reload', () => {
  it('stores only the refresh token in the vault and restores the session from it', async () => {
    const vault = memoryVault();
    const first = createCarelogAuthRuntime({
      apiBaseUrl: 'https://gateway.example.test',
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          response(200, { accessToken: 'access-one', refreshToken: 'refresh-one' }),
        ),
      sessionStore: createCarelogAuthSessionStore({ refreshTokenVault: vault }),
    });
    await first.authPort.login({ account: 'therapist-7', secret: 'secret-value' });
    expect(vault.peek()).toBe('refresh-one');

    // A reload is a new runtime over the same tab storage.
    const refreshFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response(200, { accessToken: 'access-two', refreshToken: 'refresh-two' }));
    const reloaded = createCarelogAuthRuntime({
      apiBaseUrl: 'https://gateway.example.test',
      fetchImpl: refreshFetch,
      sessionStore: createCarelogAuthSessionStore({ refreshTokenVault: vault }),
    });

    await expect(reloaded.authPort.bootstrapSession()).resolves.toEqual({
      status: 'authenticated',
    });
    expect(refreshFetch.mock.calls[0][0]).toBe('https://gateway.example.test/api/v1/auth/refresh');
    expect(JSON.parse(refreshFetch.mock.calls[0][1]?.body as string)).toEqual({
      refreshToken: 'refresh-one',
    });
    expect(reloaded.sessionStore.getAccessToken()).toBe('access-two');
    expect(vault.peek()).toBe('refresh-two');
    expect(vault.peek()).not.toBe('access-two');
  });

  it('returns to Anonymous and clears the vault when the stored refresh token is rejected', async () => {
    const vault = memoryVault('stale-refresh');
    const runtime = createCarelogAuthRuntime({
      apiBaseUrl: 'https://gateway.example.test',
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(registrationError(401)),
      sessionStore: createCarelogAuthSessionStore({ refreshTokenVault: vault }),
    });

    await expect(runtime.authPort.bootstrapSession()).resolves.toEqual({ status: 'anonymous' });
    expect(vault.peek()).toBeUndefined();
  });

  it('keeps the vault when a restore fails for a transient reason', async () => {
    const vault = memoryVault('kept-refresh');
    const runtime = createCarelogAuthRuntime({
      apiBaseUrl: 'https://gateway.example.test',
      fetchImpl: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('offline')),
      sessionStore: createCarelogAuthSessionStore({ refreshTokenVault: vault }),
    });

    await expect(runtime.authPort.bootstrapSession()).resolves.toMatchObject({
      status: 'error',
      failure: { kind: AUTH_ERROR_KIND.NETWORK },
    });
    expect(vault.peek()).toBe('kept-refresh');
  });

  it('clears the vault on logout', async () => {
    const vault = memoryVault('refresh-x');
    const runtime = createCarelogAuthRuntime({
      apiBaseUrl: 'https://gateway.example.test',
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 })),
      sessionStore: createCarelogAuthSessionStore({ refreshTokenVault: vault }),
    });

    await runtime.authPort.logout();
    expect(vault.peek()).toBeUndefined();
  });

  it('degrades to in-memory only when sessionStorage throws', async () => {
    const throwing = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      removeItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
    } as unknown as Storage;
    const vault = createSessionStorageRefreshTokenVault(throwing);
    const sessionStore = createCarelogAuthSessionStore({ refreshTokenVault: vault });
    const version = sessionStore.beginSession();

    expect(sessionStore.saveTokens({ accessToken: 'a', refreshToken: 'r' }, version)).toBe(true);
    expect(sessionStore.getRefreshToken()).toBe('r');
    expect(() => sessionStore.invalidateSession()).not.toThrow();
  });

  it('writes the refresh token under a tab-scoped sessionStorage key', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    } as unknown as Storage;
    const sessionStore = createCarelogAuthSessionStore({
      refreshTokenVault: createSessionStorageRefreshTokenVault(storage),
    });
    const version = sessionStore.beginSession();
    sessionStore.saveTokens({ accessToken: 'access-z', refreshToken: 'refresh-z' }, version);

    expect([...data.entries()]).toEqual([['carelog.auth.refreshToken', 'refresh-z']]);
  });
});

it('cancels a login waiting for logout if another logout wins', async () => {
  const logoutResponse = deferred<Response>();
  const fetchImpl = vi.fn<typeof fetch>().mockReturnValue(logoutResponse.promise);
  const sessionStore = createCarelogAuthSessionStore();
  setTokens(sessionStore, 'synthetic-a', 'synthetic-refresh-a');
  const runtime = runtimeWith(fetchImpl, sessionStore);
  const logout = runtime.authPort.logout();
  const login = runtime.authPort.login({ account: 'synthetic-b', secret: 'test' });
  const secondLogout = runtime.authPort.logout();
  logoutResponse.resolve(response(204));
  await Promise.all([logout, secondLogout]);
  await expect(login).resolves.toMatchObject({ ok: false });
  expect(fetchImpl).toHaveBeenCalledTimes(1);
  expect(sessionStore.getAccessToken()).toBeUndefined();
});

it('does not save tokens when an unmounted provider cancels its pending login', async () => {
  const loginResponse = deferred<Response>();
  const fetchImpl = vi.fn<typeof fetch>().mockReturnValue(loginResponse.promise);
  const sessionStore = createCarelogAuthSessionStore();
  const runtime = runtimeWith(fetchImpl, sessionStore);
  const pendingLogin = runtime.authPort.login({ account: 'synthetic-a', secret: 'test' });

  runtime.authPort.cancelPendingLogin?.();
  loginResponse.resolve(
    response(200, { accessToken: 'stale-access', refreshToken: 'stale-refresh' }),
  );

  await expect(pendingLogin).resolves.toMatchObject({ ok: false });
  expect(fetchImpl).toHaveBeenCalledOnce();
  expect(sessionStore.getAccessToken()).toBeUndefined();
  expect(sessionStore.getRefreshToken()).toBeUndefined();
});

it('does not replay A mutation with B credentials when switching during token refresh', async () => {
  const refreshResponse = deferred<Response>();
  const fetchImpl = vi.fn<typeof fetch>(async (input) =>
    String(input).endsWith('/auth/refresh') ? refreshResponse.promise : response(401),
  );
  const sessionStore = createCarelogAuthSessionStore();
  setTokens(sessionStore, 'synthetic-a', 'synthetic-refresh-a');
  const runtime = runtimeWith(fetchImpl, sessionStore);
  const client = createCarelogHttpClient({
    baseUrl: runtime.apiBaseUrl,
    fetchImpl,
    sessionProvider: runtime.sessionProvider,
  });
  const pending = client.post('/api/v1/private', { note: 'synthetic A note' });
  const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
  setTokens(sessionStore, 'synthetic-b', 'synthetic-refresh-b');
  refreshResponse.resolve(
    response(200, { accessToken: 'stale-a', refreshToken: 'stale-refresh-a' }),
  );
  await assertion;
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(sessionStore.getAccessToken()).toBe('synthetic-b');
  expect(sessionStore.getRefreshToken()).toBe('synthetic-refresh-b');
});

// Core KEY pattern in CarelogRegistrationCoordinator: lowercase UUIDv4 with RFC 4122 variant.
const CORE_IDEMPOTENCY_KEY =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function keyOf(call: readonly unknown[] | undefined): string {
  const init = call?.[1] as RequestInit | undefined;
  return (init?.headers as Record<string, string>)['Idempotency-Key'];
}

describe('Carelog signup password policy', () => {
  it.each([
    ['7 code points', 'a'.repeat(7)],
    ['21 code points', 'a'.repeat(21)],
    ['a control character', 'abcdefg\u0007'],
    ['too many UTF-8 bytes', '😀'.repeat(20)],
  ])('rejects %s locally without any network call', async (_label, password) => {
    const fetchImpl = vi.fn<typeof fetch>();
    const runtime = signupRuntime(fetchImpl);

    await expect(runtime.authPort.signup({ ...SIGNUP_INPUT, secret: password })).resolves.toEqual({
      ok: false,
      failure: { kind: AUTH_ERROR_KIND.UNKNOWN, reason: 'invalid-registration' },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('accepts 20 Hangul code points (60 UTF-8 bytes) and does not trim the password', async () => {
    const password = '가'.repeat(20);
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(registrationResponse(201))
      .mockResolvedValueOnce(response(200, { accessToken: 'a', refreshToken: 'r' }));
    const runtime = signupRuntime(fetchImpl);

    await expect(runtime.authPort.signup({ ...SIGNUP_INPUT, secret: password })).resolves.toEqual({
      ok: true,
    });
    expect(JSON.parse(fetchImpl.mock.calls[0][1]?.body as string).password).toBe(password);
  });
});

describe('Carelog signup retry budget', () => {
  it('marks a 503 that exhausted the retry budget so the form can offer a same-content retry', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => registrationError(503));
    const runtime = signupRuntime(fetchImpl);

    await expect(runtime.authPort.signup(SIGNUP_INPUT)).resolves.toEqual({
      ok: false,
      failure: { kind: AUTH_ERROR_KIND.SERVER, reason: 'registration-retry-exhausted' },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('starts a new key when the user edits a field after the budget ran out', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(registrationError(503))
      .mockResolvedValueOnce(registrationError(503))
      .mockResolvedValueOnce(registrationError(503))
      .mockResolvedValueOnce(registrationResponse(201))
      .mockResolvedValueOnce(response(200, { accessToken: 'a', refreshToken: 'r' }));
    const runtime = signupRuntime(fetchImpl);

    await runtime.authPort.signup(SIGNUP_INPUT);
    await runtime.authPort.signup({ ...SIGNUP_INPUT, name: '이치료' });

    expect(keyOf(fetchImpl.mock.calls[0])).not.toBe(keyOf(fetchImpl.mock.calls[3]));
    expect(JSON.parse(fetchImpl.mock.calls[3][1]?.body as string).name).toBe('이치료');
  });

  it('reuses the same key and body on a same-content retry after the budget ran out', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(registrationError(503))
      .mockResolvedValueOnce(registrationError(503))
      .mockResolvedValueOnce(registrationError(503))
      .mockResolvedValueOnce(registrationResponse(201))
      .mockResolvedValueOnce(response(200, { accessToken: 'a', refreshToken: 'r' }));
    const runtime = signupRuntime(fetchImpl);

    await runtime.authPort.signup(SIGNUP_INPUT);
    await expect(runtime.authPort.signup(SIGNUP_INPUT)).resolves.toEqual({ ok: true });

    expect(keyOf(fetchImpl.mock.calls[0])).toBe(keyOf(fetchImpl.mock.calls[3]));
    expect(fetchImpl.mock.calls[0][1]?.body).toBe(fetchImpl.mock.calls[3][1]?.body);
  });
});

describe('Carelog signup idempotency key fallback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('produces a key that matches the Core pattern when randomUUID is unavailable', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues: <T extends ArrayBufferView>(array: T): T => {
        const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
        for (let index = 0; index < bytes.length; index += 1)
          bytes[index] = (index * 37 + 11) & 0xff;
        return array;
      },
    });
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(registrationResponse(201))
      .mockResolvedValueOnce(response(200, { accessToken: 'a', refreshToken: 'r' }));
    const runtime = signupRuntime(fetchImpl);

    await runtime.authPort.signup(SIGNUP_INPUT);

    expect(keyOf(fetchImpl.mock.calls[0])).toMatch(CORE_IDEMPOTENCY_KEY);
  });

  it('produces a Core-pattern key from randomUUID as well', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(registrationResponse(201))
      .mockResolvedValueOnce(response(200, { accessToken: 'a', refreshToken: 'r' }));
    const runtime = signupRuntime(fetchImpl);

    await runtime.authPort.signup(SIGNUP_INPUT);

    expect(keyOf(fetchImpl.mock.calls[0])).toMatch(CORE_IDEMPOTENCY_KEY);
  });
});

describe('Carelog same-origin API base', () => {
  it('uses relative paths when the base is "/" so the DEV edge Worker answers them', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response(200, { accessToken: 'a', refreshToken: 'r' }));
    const runtime = createCarelogAuthRuntime({ apiBaseUrl: '/', fetchImpl });

    await expect(
      runtime.authPort.login({ account: 'therapist-7', secret: 'secret-value' }),
    ).resolves.toEqual({ ok: true });

    expect(fetchImpl.mock.calls[0][0]).toBe('/api/v1/auth/login');
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ credentials: 'omit' });
  });

  it('still refuses an empty base URL so a missing setting fails closed', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const runtime = createCarelogAuthRuntime({ apiBaseUrl: '', fetchImpl });

    await expect(
      runtime.authPort.login({ account: 'therapist-7', secret: 'secret-value' }),
    ).resolves.toEqual({ ok: false, failure: { kind: AUTH_ERROR_KIND.UNKNOWN } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
