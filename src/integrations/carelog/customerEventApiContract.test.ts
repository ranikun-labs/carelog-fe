import { describe, expect, it, vi } from 'vitest';

import { createCarelogCustomerEventPort } from '@/integrations/carelog/customerEventPort';
import { CarelogProtocolError } from '@/integrations/carelog/errors';
import { createCarelogHttpClient } from '@/integrations/carelog/httpClient';

const customerId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const eventId = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
const plannedResponse = {
  id: eventId,
  customerId,
  status: 'PLANNED',
  scheduledAt: '2026-08-20T10:00:00+09:00',
  descriptor: '상담',
  note: '초기 메모',
};

describe('Carelog CustomerEvent HTTP contract', () => {
  it('uses the BE create/list DTOs, context path, and ApiResponse envelopes', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 201,
            message: '리소스를 성공적으로 생성하였습니다.',
            data: plannedResponse,
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 200,
            message: '요청에 성공하였습니다.',
            data: [plannedResponse],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    const client = createCarelogHttpClient({
      baseUrl: 'https://carelog.example.test',
      fetchImpl,
      sessionProvider: { getAccessToken: () => 'test-access-token' },
    });
    const port = createCarelogCustomerEventPort(client);

    const created = await port.create({
      status: 'PLANNED',
      customerId,
      scheduledAt: plannedResponse.scheduledAt,
      descriptor: plannedResponse.descriptor,
      note: plannedResponse.note,
    });
    const listed = await port.list({
      customerId,
      from: '2026-08-01T00:00:00+09:00',
      to: '2026-09-01T00:00:00+09:00',
      limit: 100,
    });

    expect(created).toEqual(plannedResponse);
    expect(listed).toEqual([plannedResponse]);
    expect(fetchImpl).toHaveBeenNthCalledWith(
      1,
      'https://carelog.example.test/api/v1/customer-events',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          customerId,
          status: 'PLANNED',
          scheduledAt: plannedResponse.scheduledAt,
          descriptor: '상담',
          note: '초기 메모',
        }),
      }),
    );

    const listUrl = new URL(fetchImpl.mock.calls[1][0] as string);
    expect(listUrl.pathname).toBe('/api/v1/customer-events');
    expect(Object.fromEntries(listUrl.searchParams)).toEqual({
      limit: '100',
      customerId,
      from: '2026-08-01T00:00:00+09:00',
      to: '2026-09-01T00:00:00+09:00',
    });
  });

  it('rejects calendar-invalid OffsetDateTime input before making an HTTP request', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const client = createCarelogHttpClient({
      baseUrl: 'https://carelog.example.test',
      fetchImpl,
    });
    const port = createCarelogCustomerEventPort(client);

    await expect(
      port.create({
        status: 'PLANNED',
        customerId,
        scheduledAt: '2026-02-30T10:00:00+09:00',
      }),
    ).rejects.toBeInstanceOf(CarelogProtocolError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
