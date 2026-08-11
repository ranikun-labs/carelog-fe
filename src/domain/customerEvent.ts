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
  scheduledAt?: string;
}

export interface CancelledCustomerEvent extends CustomerEventBase {
  status: 'CANCELLED';
  scheduledAt: string;
  occurredAt?: never;
}

export type CustomerEvent = PlannedCustomerEvent | OccurredCustomerEvent | CancelledCustomerEvent;

export interface CreatePlannedCustomerEventInput {
  customerId: string;
  scheduledAt: string;
  descriptor?: string;
  note?: string;
}

export interface CreateOccurredCustomerEventInput {
  customerId: string;
  occurredAt: string;
  descriptor?: string;
  note?: string;
}

export type CustomerEventEdit = {
  descriptor?: string | null;
  note?: string | null;
  scheduledAt?: string;
  occurredAt?: string;
};

export function isOccurredCustomerEvent(event: CustomerEvent): event is OccurredCustomerEvent {
  return event.status === 'OCCURRED';
}

export function createPlannedCustomerEvent(
  id: string,
  input: CreatePlannedCustomerEventInput,
): PlannedCustomerEvent {
  return {
    id,
    customerId: input.customerId,
    status: 'PLANNED',
    scheduledAt: input.scheduledAt,
    ...(input.descriptor === undefined ? {} : { descriptor: input.descriptor }),
    ...(input.note === undefined ? {} : { note: input.note }),
  };
}

export function createOccurredCustomerEvent(
  id: string,
  input: CreateOccurredCustomerEventInput,
): OccurredCustomerEvent {
  return {
    id,
    customerId: input.customerId,
    status: 'OCCURRED',
    occurredAt: input.occurredAt,
    ...(input.descriptor === undefined ? {} : { descriptor: input.descriptor }),
    ...(input.note === undefined ? {} : { note: input.note }),
  };
}

export function editCustomerEvent(event: CustomerEvent, changes: CustomerEventEdit): CustomerEvent {
  const content = {
    ...(changes.descriptor === undefined
      ? event.descriptor === undefined
        ? {}
        : { descriptor: event.descriptor }
      : changes.descriptor === null || changes.descriptor.trim() === ''
        ? {}
        : { descriptor: changes.descriptor.trim() }),
    ...(changes.note === undefined
      ? event.note === undefined
        ? {}
        : { note: event.note }
      : changes.note === null || changes.note.trim() === ''
        ? {}
        : { note: changes.note.trim() }),
  };

  if (event.status === 'PLANNED') {
    return {
      ...content,
      id: event.id,
      customerId: event.customerId,
      status: 'PLANNED',
      scheduledAt: changes.scheduledAt ?? event.scheduledAt,
    };
  }

  if (event.status === 'CANCELLED') {
    return {
      ...content,
      id: event.id,
      customerId: event.customerId,
      status: 'CANCELLED',
      scheduledAt: event.scheduledAt,
    };
  }

  return {
    ...content,
    id: event.id,
    customerId: event.customerId,
    status: 'OCCURRED',
    occurredAt: changes.occurredAt ?? event.occurredAt,
    ...(event.scheduledAt === undefined ? {} : { scheduledAt: event.scheduledAt }),
  };
}

export function reschedulePlannedCustomerEvent(
  event: PlannedCustomerEvent,
  scheduledAt: string,
): PlannedCustomerEvent {
  return editCustomerEvent(event, { scheduledAt }) as PlannedCustomerEvent;
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
    scheduledAt: event.scheduledAt,
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
