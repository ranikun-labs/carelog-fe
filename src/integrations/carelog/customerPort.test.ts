import { describe, expect, it, vi } from 'vitest';

import { createCarelogCustomerPort } from '@/integrations/carelog/customerPort';
import { createCarelogHttpClient } from '@/integrations/carelog/httpClient';

describe('Carelog Customer port', () => {
  it('uses server publicId as the FE identity and keeps organization/workspace out of the DTO', async () => {
    const client = {
      get: vi.fn().mockResolvedValue([
        {
          publicId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          displayName: ' 고객 ',
          customerMemo: null,
        },
      ]),
      post: vi.fn(),
      patch: vi.fn(),
    };
    const port = createCarelogCustomerPort(client);

    await expect(port.list()).resolves.toEqual([
      { id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', displayName: '고객' },
    ]);
    expect(client.get).toHaveBeenCalledWith('/api/v1/users/customers');
  });

  it('reconciles create and edit from server responses, including explicit memo clear', async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({
        publicId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        displayName: '새 고객',
        customerMemo: null,
      }),
      patch: vi.fn().mockResolvedValue({
        publicId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        displayName: '새 고객',
        customerMemo: '',
      }),
    };
    const port = createCarelogCustomerPort(client);
    const created = await port.create({ displayName: '새 고객' });
    const current = { ...created, customerMemo: '기존 메모' };
    const edited = await port.edit(created.id, current, {
      displayName: '새 고객',
      customerMemo: '   ',
    });

    expect(created.id).toBe('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
    expect(edited).toEqual({ id: created.id, displayName: '새 고객' });
    expect(client.post).toHaveBeenCalledWith('/api/v1/users/customers', {
      displayName: '새 고객',
      customerMemo: null,
    });
    expect(client.patch).toHaveBeenCalledWith(
      '/api/v1/users/customers/6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      {
        customerMemo: '',
      },
    );
  });

  it('reads back edited name and memo with mocked HTTP (no real server)', async () => {
    const customerId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    const before = {
      publicId: customerId,
      displayName: '기존 고객',
      customerMemo: '기존 메모',
    };
    const after = {
      publicId: customerId,
      displayName: '수정 고객',
      customerMemo: '수정 메모',
    };
    const mockedFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 200, message: 'ok', data: before }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 200, message: 'ok', data: after }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 200, message: 'ok', data: after }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    const client = createCarelogHttpClient({
      baseUrl: 'https://carelog.example.test',
      fetchImpl: mockedFetch,
      sessionProvider: { getAccessToken: () => 'test-access-token' },
    });
    const port = createCarelogCustomerPort(client);

    const current = await port.get(customerId);
    const edited = await port.edit(customerId, current, {
      displayName: '수정 고객',
      customerMemo: '수정 메모',
    });
    const readBack = await port.get(customerId);

    expect(edited).toEqual({ id: customerId, displayName: '수정 고객', customerMemo: '수정 메모' });
    expect(readBack).toEqual(edited);
    expect(mockedFetch).toHaveBeenCalledTimes(3);
    expect(mockedFetch).toHaveBeenNthCalledWith(
      2,
      `https://carelog.example.test/api/v1/users/customers/${customerId}`,
      expect.objectContaining({
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer test-access-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayName: '수정 고객', customerMemo: '수정 메모' }),
      }),
    );
    expect(mockedFetch).toHaveBeenNthCalledWith(
      3,
      `https://carelog.example.test/api/v1/users/customers/${customerId}`,
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
