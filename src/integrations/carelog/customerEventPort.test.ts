import { describe, expect, it, vi } from 'vitest';

import type { CustomerEvent } from '@/domain/customerEvent';
import {
  createCarelogCustomerEventPort,
  createCustomerHistoryQuery,
  createCustomerUpcomingQuery,
  createScheduleQuery,
} from '@/integrations/carelog/customerEventPort';

const customerId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const eventId = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
const planned: CustomerEvent = {
  id: eventId,
  customerId,
  status: 'PLANNED',
  scheduledAt: '2026-08-20T10:00:00+09:00',
  descriptor: '상담',
};

describe('Carelog CustomerEvent port', () => {
  it('builds bounded schedule and customer queries', () => {
    expect(
      createScheduleQuery({ from: '2026-08-17T00:00:00+09:00', to: '2026-08-24T00:00:00+09:00' }),
    ).toEqual({
      from: '2026-08-17T00:00:00+09:00',
      to: '2026-08-24T00:00:00+09:00',
      limit: 100,
    });
    expect(
      createCustomerUpcomingQuery(customerId, {
        from: '2026-08-17T00:00:00+09:00',
        to: '2026-11-17T00:00:00+09:00',
      }),
    ).toMatchObject({ customerId, limit: 100 });
    expect(createCustomerHistoryQuery(customerId)).toEqual({ customerId, limit: 50 });
  });

  it('uses bounded URL parameters, maps wire invariants, and keeps lifecycle calls server-backed', async () => {
    const client = {
      get: vi
        .fn()
        .mockResolvedValue([
          { ...planned, scheduledAt: planned.scheduledAt, occurredAt: null, note: null },
        ]),
      post: vi
        .fn()
        .mockResolvedValueOnce({
          ...planned,
          status: 'OCCURRED',
          occurredAt: '2026-08-20T10:30:00+09:00',
          note: null,
        })
        .mockResolvedValueOnce({ ...planned, status: 'CANCELLED', occurredAt: null, note: null }),
      patch: vi
        .fn()
        .mockResolvedValue({ ...planned, descriptor: null, occurredAt: null, note: null }),
    };
    const port = createCarelogCustomerEventPort(client);
    const range = { from: '2026-08-17T00:00:00+09:00', to: '2026-08-24T00:00:00+09:00' };

    await port.list(createCustomerUpcomingQuery(customerId, range));
    await port.edit(planned, { descriptor: '   ' });
    await port.occur(eventId, '2026-08-20T10:30:00+09:00');
    await port.cancel(eventId);

    expect(client.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/customer-events?limit=100&customerId='),
    );
    expect(client.patch).toHaveBeenCalledWith(`/api/v1/customer-events/${eventId}`, {
      descriptor: null,
    });
    expect(client.post).toHaveBeenNthCalledWith(
      1,
      '/api/v1/customer-events/6ba7b811-9dad-11d1-80b4-00c04fd430c8/occur',
      {
        occurredAt: '2026-08-20T10:30:00+09:00',
      },
    );
    expect(client.post).toHaveBeenNthCalledWith(
      2,
      '/api/v1/customer-events/6ba7b811-9dad-11d1-80b4-00c04fd430c8/cancel',
    );
  });

  it('rejects unbounded or partial ranges before making an HTTP request', async () => {
    const client = { get: vi.fn(), post: vi.fn(), patch: vi.fn() };
    const port = createCarelogCustomerEventPort(client);

    await expect(port.list({ limit: 100 })).rejects.toThrow(/bounded|customer-scoped/);
    await expect(port.list({ from: '2026-08-17T00:00:00+09:00', limit: 100 })).rejects.toThrow(
      /both from and to/,
    );
    expect(client.get).not.toHaveBeenCalled();
  });
});
