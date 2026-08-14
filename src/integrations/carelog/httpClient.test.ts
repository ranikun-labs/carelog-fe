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
