import {
  CUSTOMER_EVENT_STATUSES,
  cancelPlannedCustomerEvent,
  isCustomerEventOverdue,
  occurPlannedCustomerEvent,
  type CancelledCustomerEvent,
  type CustomerEvent,
  type OccurredCustomerEvent,
  type PlannedCustomerEvent,
} from '@/domain/customerEvent';

const plannedEvent: PlannedCustomerEvent = {
  id: 'event-1',
  customerId: 'customer-1',
  status: 'PLANNED',
  scheduledAt: '2026-08-11T09:30:00+09:00',
  descriptor: '방문 일정 확인',
  note: '오전 시간대 연락 선호',
};

describe('CustomerEvent', () => {
  it('keeps the canonical statuses exact', () => {
    expect(CUSTOMER_EVENT_STATUSES).toEqual(['PLANNED', 'OCCURRED', 'CANCELLED']);
  });

  it('derives overdue only for a valid PLANNED instant strictly before now', () => {
    const occurred: OccurredCustomerEvent = {
      id: 'occurred-1',
      customerId: 'customer-1',
      status: 'OCCURRED',
      occurredAt: plannedEvent.scheduledAt,
    };
    const cancelled: CancelledCustomerEvent = {
      id: 'cancelled-1',
      customerId: 'customer-1',
      status: 'CANCELLED',
      scheduledAt: plannedEvent.scheduledAt,
    };

    expect(isCustomerEventOverdue(plannedEvent, '2026-08-11T09:31:00+09:00')).toBe(true);
    expect(isCustomerEventOverdue(plannedEvent, plannedEvent.scheduledAt)).toBe(false);
    expect(isCustomerEventOverdue(occurred, '2026-08-12T00:00:00+09:00')).toBe(false);
    expect(isCustomerEventOverdue(cancelled, '2026-08-12T00:00:00+09:00')).toBe(false);
    expect(
      isCustomerEventOverdue({ ...plannedEvent, scheduledAt: 'invalid' }, '2026-08-12T00:00:00Z'),
    ).toBe(false);
    expect(isCustomerEventOverdue(plannedEvent, 'invalid')).toBe(false);
  });

  it('preserves scheduledAt and uses it as the default occurrence coordinate', () => {
    expect(occurPlannedCustomerEvent(plannedEvent)).toEqual({
      id: plannedEvent.id,
      customerId: plannedEvent.customerId,
      status: 'OCCURRED',
      occurredAt: plannedEvent.scheduledAt,
      scheduledAt: plannedEvent.scheduledAt,
      descriptor: plannedEvent.descriptor,
      note: plannedEvent.note,
    });
  });

  it('uses actual time while preserving the original schedule when the instants differ', () => {
    const actualTime = '2026-08-11T10:05:00+09:00';
    const occurred = occurPlannedCustomerEvent(plannedEvent, actualTime);

    expect(occurred.scheduledAt).toBe(plannedEvent.scheduledAt);
    expect(occurred.occurredAt).toBe(actualTime);
    expect(occurred.scheduledAt).not.toBe(occurred.occurredAt);
  });

  it('retains both planned and actual coordinates for transitioned event detail', () => {
    const actualTime = '2026-08-11T10:05:00+09:00';
    const transitioned: OccurredCustomerEvent = occurPlannedCustomerEvent(plannedEvent, actualTime);

    expect({
      scheduledAt: transitioned.scheduledAt,
      occurredAt: transitioned.occurredAt,
    }).toEqual({
      scheduledAt: plannedEvent.scheduledAt,
      occurredAt: actualTime,
    });
  });

  it('preserves the original scheduledAt when cancelling without synthesizing occurredAt', () => {
    expect(cancelPlannedCustomerEvent(plannedEvent)).toEqual({
      ...plannedEvent,
      status: 'CANCELLED',
    });
    expect(cancelPlannedCustomerEvent(plannedEvent)).not.toHaveProperty('occurredAt');
  });

  it('allows an immediate OCCURRED event with no scheduled coordinate', () => {
    const immediateEvent: CustomerEvent = {
      id: 'event-immediate',
      customerId: 'customer-1',
      status: 'OCCURRED',
      occurredAt: '2026-08-11T11:00:00+09:00',
      descriptor: '즉시 기록',
    };

    expect(immediateEvent).not.toHaveProperty('scheduledAt');
  });
});
