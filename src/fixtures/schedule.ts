import { adaptLegacyCustomerEvents } from '@/adapters/legacyCustomerEventAdapter';
import type { CustomerEvent } from '@/domain/customerEvent';
import { SCENARIO_FIXTURES } from '@/fixtures/scenarios';
import type { ScheduleCustomer } from '@/types/customer';

export type { ScheduleCustomer } from '@/types/customer';

export interface ScheduleFixture {
  events: readonly CustomerEvent[];
  customers: readonly ScheduleCustomer[];
}

const adapterDerivedEvents: readonly CustomerEvent[] = SCENARIO_FIXTURES.flatMap(
  (scenario) =>
    adaptLegacyCustomerEvents({
      timelineEntries: scenario.timeline,
      followUps: [scenario.followUp],
    }).events,
);

/**
 * The API is not connected yet, so this fixture keeps the vertical slice
 * useful while exercising every canonical time coordinate. The extra records
 * are CustomerEvents directly; no UI-only status or event type is introduced.
 */
const canonicalScheduleEvents = [
  {
    id: 'event-tenant-transitioned',
    customerId: 'customer-tenant-1',
    status: 'OCCURRED',
    scheduledAt: '2026-08-11T10:00:00+09:00',
    occurredAt: '2026-08-11T10:45:00+09:00',
    descriptor: '계약 갱신 상담',
    note: '계약 조건을 다시 확인했습니다.',
  },
  {
    id: 'event-tenant-cancelled',
    customerId: 'customer-tenant-1',
    status: 'CANCELLED',
    scheduledAt: '2026-08-12T13:30:00+09:00',
    descriptor: '현장 확인 일정',
    note: '고객 요청으로 일정을 취소했습니다.',
  },
  {
    id: 'event-patient-immediate',
    customerId: 'customer-patient-1',
    status: 'OCCURRED',
    occurredAt: '2026-08-11T13:00:00+09:00',
    descriptor: '내원 확인 기록',
  },
] satisfies readonly CustomerEvent[];

export const SCHEDULE_FIXTURE: ScheduleFixture = {
  events: [...adapterDerivedEvents, ...canonicalScheduleEvents],
  customers: SCENARIO_FIXTURES.map(({ customer }) => ({
    id: customer.id,
    displayName: customer.displayName,
  })),
};
