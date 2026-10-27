import { describe, expect, it, vi } from 'vitest';

import {
  CarelogConfigurationError,
  CarelogHttpError,
  CarelogNetworkError,
  CarelogProtocolError,
} from '@/integrations/carelog/errors';
import { createCarelogHttpClient } from '@/integrations/carelog/httpClient';

function response(status: number, body: string, headers = { 'content-type': 'application/json' }) {
  return new Response(status === 204 ? null : body, { status, headers });
}

describe('Carelog native HTTP client', () => {
  it('returns validated envelope data and sends only configured session credentials', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        response(200, JSON.stringify({ status: 200, message: 'ok', data: { value: 'ready' } })),
      );
    const client = createCarelogHttpClient({
      baseUrl: 'https://carelog.example.test/',
      fetchImpl,
      sessionProvider: {
        credentials: 'include',
        getAccessToken: () => 'access-token',
      },
    });

    await expect(client.get('/api/v1/users/customers')).resolves.toEqual({ value: 'ready' });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://carelog.example.test/api/v1/users/customers',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json', Authorization: 'Bearer access-token' },
      }),
    );
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(init.headers).not.toHaveProperty('X-Gateway-Secret');
    expect(init.headers).not.toHaveProperty('X-User-Id');
    expect(init.headers).not.toHaveProperty('X-Organization-Id');
    expect(init.headers).not.toHaveProperty('X-Role');
  });

  it('rejects malformed success envelopes as protocol errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(200, JSON.stringify({ data: {} })));
    const client = createCarelogHttpClient({ baseUrl: 'https://carelog.example.test', fetchImpl });

    await expect(client.get('/api/v1/users/customers')).rejects.toBeInstanceOf(
      CarelogProtocolError,
    );
  });

  it('rejects a success envelope whose status disagrees with HTTP', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(response(201, JSON.stringify({ status: 200, message: 'ok', data: {} })));
    const client = createCarelogHttpClient({ baseUrl: 'https://carelog.example.test', fetchImpl });

    await expect(client.get('/api/v1/users/customers')).rejects.toBeInstanceOf(
      CarelogProtocolError,
    );
  });

  it('accepts an empty 204 response without requiring an envelope', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(204, ''));
    const client = createCarelogHttpClient({ baseUrl: 'https://carelog.example.test', fetchImpl });

    await expect(client.post('/api/v1/customer-events/event-1/cancel')).resolves.toBeUndefined();
  });

  it('preserves non-envelope HTTP error bodies and classifies by status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(409, 'conflict from gateway'));
    const client = createCarelogHttpClient({ baseUrl: 'https://carelog.example.test', fetchImpl });

    await expect(client.get('/api/v1/customer-events/event-1')).rejects.toMatchObject({
      name: 'CarelogHttpError',
      status: 409,
      body: 'conflict from gateway',
    } satisfies Partial<CarelogHttpError>);
  });

  it('separates network failures from HTTP status failures', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('offline'));
    const client = createCarelogHttpClient({ baseUrl: 'https://carelog.example.test', fetchImpl });

    await expect(client.get('/api/v1/users/customers')).rejects.toBeInstanceOf(CarelogNetworkError);
  });

  it('fails closed when the production API base is missing', () => {
    expect(() => createCarelogHttpClient({ baseUrl: '' })).toThrow(CarelogConfigurationError);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

it.each([200, 204, 401, 403, 500])(
  'cancels an A response with HTTP %s after switching to B, without auth side effects',
  async (status) => {
    let version = 1;
    const pending = deferred<Response>();
    const fetchImpl = vi.fn<typeof fetch>().mockReturnValue(pending.promise);
    const onUnauthorized = vi.fn();
    const recoverAccessToken = vi.fn();
    const client = createCarelogHttpClient({
      baseUrl: 'https://carelog.example.test',
      fetchImpl,
      onUnauthorized,
      sessionProvider: {
        getAccessToken: () => 'synthetic-a',
        getSessionVersion: () => version,
        recoverAccessToken,
      },
    });
    const result = client.get('/api/v1/private');
    const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    version = 2;
    pending.resolve(
      response(status, JSON.stringify({ status, message: 'ok', data: { private: 'synthetic-a' } })),
    );
    await assertion;
    expect(onUnauthorized).not.toHaveBeenCalled();
    expect(recoverAccessToken).not.toHaveBeenCalled();
  },
);

it('does not dispatch a request when session changes while resolving its bearer', async () => {
  let version = 1;
  const token = deferred<string>();
  const fetchImpl = vi.fn<typeof fetch>();
  const client = createCarelogHttpClient({
    baseUrl: 'https://carelog.example.test',
    fetchImpl,
    sessionProvider: { getAccessToken: () => token.promise, getSessionVersion: () => version },
  });
  const result = client.post('/api/v1/private', { private: 'synthetic-a' });
  const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  version = 2;
  token.resolve('synthetic-b');
  await assertion;
  expect(fetchImpl).not.toHaveBeenCalled();
});

it('discards A data if switching happens during response body reading', async () => {
  let version = 1;
  const body = deferred<string>();
  const text = vi.fn().mockReturnValue(body.promise);
  const fetched = response(200, '');
  fetched.text = text;
  const client = createCarelogHttpClient({
    baseUrl: 'https://carelog.example.test',
    fetchImpl: vi.fn().mockResolvedValue(fetched),
    sessionProvider: { getAccessToken: () => 'synthetic-a', getSessionVersion: () => version },
  });
  const result = client.get('/api/v1/private');
  const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  await vi.waitFor(() => expect(text).toHaveBeenCalledTimes(1));
  version = 2;
  body.resolve(JSON.stringify({ status: 200, message: 'ok', data: { private: 'synthetic-a' } }));
  await assertion;
});

it('discards stale network failures without reporting them against B', async () => {
  let version = 1;
  const pending = deferred<Response>();
  const fetchImpl = vi.fn<typeof fetch>().mockReturnValue(pending.promise);
  const client = createCarelogHttpClient({
    baseUrl: 'https://carelog.example.test',
    fetchImpl,
    sessionProvider: { getAccessToken: () => 'synthetic-a', getSessionVersion: () => version },
  });
  const result = client.get('/api/v1/private');
  const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
  version = 2;
  pending.reject(new TypeError('offline'));
  await assertion;
});

it.each([403, 500])(
  'does not treat an HTTP %s refresh failure as terminal session expiry',
  async (status) => {
    const invalidateSessionIfVersion = vi.fn(() => true);
    const onTerminalUnauthorized = vi.fn();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(401, ''));
    const client = createCarelogHttpClient({
      baseUrl: 'https://carelog.example.test',
      fetchImpl,
      onTerminalUnauthorized,
      sessionProvider: {
        getAccessToken: () => 'access-one',
        getSessionVersion: () => 1,
        recoverAccessToken: async () => {
          throw new CarelogHttpError(status);
        },
        invalidateSessionIfVersion,
      },
    });

    await expect(client.get('/api/v1/private')).rejects.toMatchObject({
      name: 'CarelogHttpError',
      status,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(invalidateSessionIfVersion).not.toHaveBeenCalled();
    expect(onTerminalUnauthorized).not.toHaveBeenCalled();
  },
);

it('does not treat a network refresh failure as terminal session expiry', async () => {
  const invalidateSessionIfVersion = vi.fn(() => true);
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(401, ''));
  const client = createCarelogHttpClient({
    baseUrl: 'https://carelog.example.test',
    fetchImpl,
    sessionProvider: {
      getAccessToken: () => 'access-one',
      getSessionVersion: () => 1,
      recoverAccessToken: async () => {
        throw new CarelogNetworkError('offline');
      },
      invalidateSessionIfVersion,
    },
  });

  await expect(client.get('/api/v1/private')).rejects.toBeInstanceOf(CarelogNetworkError);
  expect(invalidateSessionIfVersion).not.toHaveBeenCalled();
});

it('discards a refresh failure from A after switching to B', async () => {
  let version = 1;
  const refresh = deferred<string | undefined>();
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response(401, ''));
  const onTerminalUnauthorized = vi.fn();
  const client = createCarelogHttpClient({
    baseUrl: 'https://carelog.example.test',
    fetchImpl,
    onTerminalUnauthorized,
    sessionProvider: {
      getAccessToken: () => 'synthetic-a',
      getSessionVersion: () => version,
      recoverAccessToken: () => refresh.promise,
      invalidateSessionIfVersion: vi.fn(() => true),
    },
  });
  const result = client.get('/api/v1/private');
  const assertion = expect(result).rejects.toMatchObject({ name: 'AbortError' });
  await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalledOnce());

  version = 2;
  refresh.reject(new CarelogHttpError(500));
  await assertion;
  expect(onTerminalUnauthorized).not.toHaveBeenCalled();
  expect(fetchImpl).toHaveBeenCalledOnce();
});
