import { getAgendaCoordinate } from '@/components/schedule/agendaModel';
import type { CustomerEvent, PlannedCustomerEvent } from '@/domain/customerEvent';

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
        Date.parse(event.scheduledAt) > nowInstant,
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
