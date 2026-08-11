export const CUSTOMER_EVENT_STATUSES = ['PLANNED', 'OCCURRED', 'CANCELLED'] as const;

export type CustomerEventStatus = (typeof CUSTOMER_EVENT_STATUSES)[number];

interface CustomerEventBase {
  id: string;
  customerId: string;
  descriptor?: string;
  note?: string;
}

export interface PlannedCustomerEvent extends CustomerEventBase {
  status: 'PLANNED';
  scheduledAt: string;
  occurredAt?: never;
}

export interface OccurredCustomerEvent extends CustomerEventBase {
  status: 'OCCURRED';
  occurredAt: string;
  scheduledAt?: never;
}

export interface CancelledCustomerEvent extends CustomerEventBase {
  status: 'CANCELLED';
  scheduledAt: string;
  occurredAt?: never;
}

export type CustomerEvent = PlannedCustomerEvent | OccurredCustomerEvent | CancelledCustomerEvent;

export function isOccurredCustomerEvent(event: CustomerEvent): event is OccurredCustomerEvent {
  return event.status === 'OCCURRED';
}

export function isCustomerEventOverdue(event: CustomerEvent, now: string | number | Date): boolean {
  if (event.status !== 'PLANNED') return false;

  const scheduledInstant = Date.parse(event.scheduledAt);
  const nowInstant = now instanceof Date ? now.getTime() : new Date(now).getTime();

  return (
    !Number.isNaN(scheduledInstant) && !Number.isNaN(nowInstant) && scheduledInstant < nowInstant
  );
}

export function occurPlannedCustomerEvent(
  event: PlannedCustomerEvent,
  occurredAt: string = event.scheduledAt,
): OccurredCustomerEvent {
  return {
    id: event.id,
    customerId: event.customerId,
    status: 'OCCURRED',
    occurredAt,
    ...(event.descriptor === undefined ? {} : { descriptor: event.descriptor }),
    ...(event.note === undefined ? {} : { note: event.note }),
  };
}

export function cancelPlannedCustomerEvent(event: PlannedCustomerEvent): CancelledCustomerEvent {
  return {
    ...event,
    status: 'CANCELLED',
  };
}
