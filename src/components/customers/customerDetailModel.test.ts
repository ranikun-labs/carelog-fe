import {
  CUSTOMER_HISTORY_INITIAL_LIMIT,
  CUSTOMER_HISTORY_PAGE_SIZE,
  getCustomerHistoryEvents,
  getOverdueCustomerEvents,
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

  it('returns no upcoming events when only overdue PLANNED or past events exist (overdue is its own list)', () => {
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

describe('getOverdueCustomerEvents', () => {
  it('returns only PLANNED events past their scheduled time, oldest first', () => {
    const events: CustomerEvent[] = [
      { id: 'b', customerId: 'c', status: 'PLANNED', scheduledAt: '2026-08-11T09:30:00+09:00' },
      { id: 'a', customerId: 'c', status: 'PLANNED', scheduledAt: '2026-08-09T09:30:00+09:00' },
      {
        id: 'future',
        customerId: 'c',
        status: 'PLANNED',
        scheduledAt: '2026-08-12T09:30:00+09:00',
      },
      { id: 'occ', customerId: 'c', status: 'OCCURRED', occurredAt: '2026-08-10T09:30:00+09:00' },
      { id: 'can', customerId: 'c', status: 'CANCELLED', scheduledAt: '2026-08-10T09:30:00+09:00' },
    ];
    expect(getOverdueCustomerEvents(events, now).map((event) => event.id)).toEqual(['a', 'b']);
  });

  it('never loses an event at the exact current instant (upcoming includes it, overdue excludes it)', () => {
    const exact: CustomerEvent = {
      id: 'exact',
      customerId: 'c',
      status: 'PLANNED',
      scheduledAt: '2026-08-11T12:00:00+09:00',
    };
    expect(getOverdueCustomerEvents([exact], now)).toEqual([]);
    expect(getUpcomingCustomerEvents([exact], now)).toEqual([exact]);
  });
});
