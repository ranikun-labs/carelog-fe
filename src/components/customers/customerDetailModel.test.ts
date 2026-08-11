import {
  CUSTOMER_HISTORY_INITIAL_LIMIT,
  CUSTOMER_HISTORY_PAGE_SIZE,
  getCustomerHistoryEvents,
  getUpcomingCustomerEvents,
} from '@/components/customers/customerDetailModel';
import type { CustomerEvent } from '@/domain/customerEvent';

const now = new Date('2026-08-11T12:00:00+09:00');

describe('customer detail projections', () => {
  it('selects the nearest future PLANNED event and excludes occurred and overdue events', () => {
    const events: CustomerEvent[] = [
      {
        id: 'occurred-latest',
        customerId: 'customer-1',
        status: 'OCCURRED',
        occurredAt: '2026-08-11T11:00:00+09:00',
        descriptor: 'latest occurred',
      },
      {
        id: 'planned-overdue',
        customerId: 'customer-1',
        status: 'PLANNED',
        scheduledAt: '2026-08-11T10:00:00+09:00',
        descriptor: 'overdue planned',
      },
      {
        id: 'planned-later',
        customerId: 'customer-1',
        status: 'PLANNED',
        scheduledAt: '2026-08-13T10:00:00+09:00',
        descriptor: 'later planned',
      },
      {
        id: 'planned-nearest',
        customerId: 'customer-1',
        status: 'PLANNED',
        scheduledAt: '2026-08-12T10:00:00+09:00',
        descriptor: 'nearest planned',
      },
    ];

    expect(getUpcomingCustomerEvents(events, now).map((event) => event.id)).toEqual([
      'planned-nearest',
      'planned-later',
    ]);
  });

  it('returns no upcoming events when only overdue PLANNED or past events exist', () => {
    expect(
      getUpcomingCustomerEvents(
        [
          {
            id: 'overdue',
            customerId: 'customer-1',
            status: 'PLANNED',
            scheduledAt: '2026-08-10T10:00:00+09:00',
          },
          {
            id: 'occurred',
            customerId: 'customer-1',
            status: 'OCCURRED',
            occurredAt: '2026-08-11T11:00:00+09:00',
          },
        ],
        now,
      ),
    ).toEqual([]);
  });

  it('projects OCCURRED and CANCELLED chronologically while excluding PLANNED', () => {
    const events: CustomerEvent[] = [
      {
        id: 'planned',
        customerId: 'customer-1',
        status: 'PLANNED',
        scheduledAt: '2026-08-20T10:00:00+09:00',
      },
      {
        id: 'cancelled',
        customerId: 'customer-1',
        status: 'CANCELLED',
        scheduledAt: '2026-08-12T10:00:00+09:00',
      },
      {
        id: 'occurred',
        customerId: 'customer-1',
        status: 'OCCURRED',
        occurredAt: '2026-08-13T10:00:00+09:00',
      },
    ];

    expect(getCustomerHistoryEvents(events).map((event) => event.id)).toEqual([
      'occurred',
      'cancelled',
    ]);
  });

  it('keeps the history page constants at the locked eight-item increment', () => {
    expect(CUSTOMER_HISTORY_INITIAL_LIMIT).toBe(8);
    expect(CUSTOMER_HISTORY_PAGE_SIZE).toBe(8);
  });
});
