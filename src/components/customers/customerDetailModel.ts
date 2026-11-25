import { getAgendaCoordinate } from '@/components/schedule/agendaModel';
import {
  isCustomerEventOverdue,
  type CustomerEvent,
  type PlannedCustomerEvent,
} from '@/domain/customerEvent';

export type CustomerHistoryEvent = Extract<CustomerEvent, { status: 'OCCURRED' | 'CANCELLED' }>;

export const CUSTOMER_HISTORY_INITIAL_LIMIT = 8;
export const CUSTOMER_HISTORY_PAGE_SIZE = 8;

export function getUpcomingCustomerEvents(
  events: readonly CustomerEvent[],
  now: string | number | Date,
): PlannedCustomerEvent[] {
  const nowInstant = toInstant(now);
  if (Number.isNaN(nowInstant)) return [];

  return events
    .filter(
      (event): event is PlannedCustomerEvent =>
        event.status === 'PLANNED' &&
        isValidInstant(event.scheduledAt) &&
        Date.parse(event.scheduledAt) >= nowInstant,
    )
    .sort(compareUpcomingEvents);
}

/**
 * 예정 시각이 지난 PLANNED(정리 필요, 파생 Overdue). 가장 오래 밀린 일정이 먼저다.
 * 고객 상세가 이 일정을 숨기면 고객 화면만 보는 사용자가 밀린 일을 놓친다.
 */
export function getOverdueCustomerEvents(
  events: readonly CustomerEvent[],
  now: string | number | Date,
): PlannedCustomerEvent[] {
  return events
    .filter(
      (event): event is PlannedCustomerEvent =>
        event.status === 'PLANNED' && isCustomerEventOverdue(event, now),
    )
    .sort(compareUpcomingEvents);
}

export function getCustomerHistoryEvents(events: readonly CustomerEvent[]): CustomerHistoryEvent[] {
  return events.filter(isCustomerHistoryEvent).sort(compareHistoryEvents);
}

export function isCustomerHistoryEvent(event: CustomerEvent): event is CustomerHistoryEvent {
  return event.status === 'OCCURRED' || event.status === 'CANCELLED';
}

function compareUpcomingEvents(first: PlannedCustomerEvent, second: PlannedCustomerEvent): number {
  return (
    compareInstants(first.scheduledAt, second.scheduledAt) || first.id.localeCompare(second.id)
  );
}

function compareHistoryEvents(first: CustomerHistoryEvent, second: CustomerHistoryEvent): number {
  const firstCoordinate = getAgendaCoordinate(first);
  const secondCoordinate = getAgendaCoordinate(second);
  const firstInstant = Date.parse(firstCoordinate);
  const secondInstant = Date.parse(secondCoordinate);
  const firstInvalid = Number.isNaN(firstInstant);
  const secondInvalid = Number.isNaN(secondInstant);

  if (firstInvalid || secondInvalid) {
    if (firstInvalid && secondInvalid) return first.id.localeCompare(second.id);
    return firstInvalid ? 1 : -1;
  }

  return secondInstant - firstInstant || first.id.localeCompare(second.id);
}

function compareInstants(first: string, second: string): number {
  const firstInstant = Date.parse(first);
  const secondInstant = Date.parse(second);
  const firstInvalid = Number.isNaN(firstInstant);
  const secondInvalid = Number.isNaN(secondInstant);

  if (firstInvalid || secondInvalid) {
    if (firstInvalid && secondInvalid) return 0;
    return firstInvalid ? 1 : -1;
  }

  return firstInstant - secondInstant;
}

function isValidInstant(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function toInstant(value: string | number | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}
