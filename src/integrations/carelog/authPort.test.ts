import { describe, expect, it, vi } from 'vitest';

import { AUTH_ERROR_KIND } from '@/auth/authTypes';
import {
  createCarelogAuthRuntime,
  createCarelogAuthSessionStore,
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

  it('transitions safely to anonymous and clears tokens after a rejected refresh', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(401, null));
    const sessionStore = createCarelogAuthSessionStore();
    setTokens(sessionStore, 'expired-access', 'revoked-refresh');
    const runtime = runtimeWith(fetchImpl, sessionStore);

    await expect(runtime.authPort.bootstrapSession()).resolves.toEqual({ status: 'anonymous' });
    expect(runtime.sessionProvider.getAccessToken?.()).toBeUndefined();
    expect(sessionStore.getRefreshToken()).toBeUndefined();
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

  it('does not invent a production signup endpoint', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const runtime = runtimeWith(fetchImpl);

    await expect(
      runtime.authPort.signup({ account: 'new-user', secret: 'secret' }),
    ).resolves.toEqual({
      ok: false,
      failure: { kind: AUTH_ERROR_KIND.UNKNOWN },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
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
