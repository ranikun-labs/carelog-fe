import type { CustomerEvent } from '@/domain/customerEvent';
import {
  buildCreatedCustomer,
  createCustomerId,
  editCustomerById,
  type CustomerCreateInput,
  type CustomerEditInput,
} from '@/state/customerStore';
import {
  buildCreatedCustomerEvent,
  cancelEventById,
  createCustomerEventId,
  editEventById,
  occurEventById,
  type EventCreationInput,
} from '@/state/eventStore';
import type { CustomerRecord } from '@/types/customer';
import { CUSTOMER_FIXTURE_RECORDS } from '@/fixtures/scenarios';
import { SCHEDULE_FIXTURE } from '@/fixtures/schedule';
import {
  createCustomerHistoryQuery,
  createCustomerUpcomingQuery,
  createScheduleQuery,
  type CustomerEventListQuery,
  type CustomerEventPort,
  type CustomerEventCreationInput,
} from '@/integrations/carelog/customerEventPort';
import type { CustomerPort } from '@/integrations/carelog/customerPort';

export function createFixtureCustomerPort(
  initialCustomers: readonly CustomerRecord[] = CUSTOMER_FIXTURE_RECORDS,
): CustomerPort {
  let customers = [...initialCustomers];
  return {
    list: async () => customers,
    get: async (customerId) => {
      const customer = customers.find((candidate) => candidate.id === customerId);
      if (!customer) throw new Error(`Fixture customer not found: ${customerId}`);
      return customer;
    },
    create: async (input: CustomerCreateInput) => {
      const customer = buildCreatedCustomer(createCustomerId(customers), input, undefined);
      if (!customer) throw new Error('Fixture customer name is required.');
      customers = [...customers, customer];
      return customer;
    },
    edit: async (customerId: string, current: CustomerRecord, input: CustomerEditInput) => {
      const updated = editCustomerById(customers, customerId, input);
      if (!updated) throw new Error(`Fixture customer not found: ${customerId}`);
      customers = customers.map((candidate) => (candidate.id === customerId ? updated : candidate));
      return { ...updated, ...(current.workspace ? { workspace: current.workspace } : {}) };
    },
  };
}

export function createFixtureCustomerEventPort(
  initialEvents: readonly CustomerEvent[] = SCHEDULE_FIXTURE.events,
): CustomerEventPort {
  let events = [...initialEvents];
  return {
    list: async (query) => filterFixtureEvents(events, query),
    get: async (eventId) => {
      const event = events.find((candidate) => candidate.id === eventId);
      if (!event) throw new Error(`Fixture event not found: ${eventId}`);
      return event;
    },
    create: async (input: CustomerEventCreationInput) => {
      const event = buildCreatedCustomerEvent(
        createCustomerEventId(events),
        input as EventCreationInput,
      );
      events = [...events, event];
      return event;
    },
    edit: async (current, changes) => {
      const event = editEventById(events, current.id, changes);
      if (!event) throw new Error(`Fixture event not found: ${current.id}`);
      events = events.map((candidate) => (candidate.id === event.id ? event : candidate));
      return event;
    },
    occur: async (eventId, occurredAt) => {
      const event = occurEventById(events, eventId, occurredAt);
      if (!event) throw new Error(`Fixture event cannot occur: ${eventId}`);
      events = events.map((candidate) => (candidate.id === event.id ? event : candidate));
      return event;
    },
    cancel: async (eventId) => {
      const event = cancelEventById(events, eventId);
      if (!event) throw new Error(`Fixture event cannot cancel: ${eventId}`);
      events = events.map((candidate) => (candidate.id === event.id ? event : candidate));
      return event;
    },
  };
}

function filterFixtureEvents(events: readonly CustomerEvent[], query: CustomerEventListQuery) {
  const scheduleQuery =
    query.from && query.to
      ? createScheduleQuery({ from: query.from, to: query.to }, query.limit)
      : undefined;
  const upcomingQuery =
    query.customerId && query.from && query.to
      ? createCustomerUpcomingQuery(
          query.customerId,
          { from: query.from, to: query.to },
          query.limit,
        )
      : undefined;
  const historyQuery =
    query.customerId && !query.from
      ? createCustomerHistoryQuery(query.customerId, query.limit)
      : undefined;
  const selected = events.filter((event) => {
    if (query.customerId && event.customerId !== query.customerId) return false;
    const coordinate = event.status === 'OCCURRED' ? event.occurredAt : event.scheduledAt;
    if (query.from && Date.parse(coordinate) < Date.parse(query.from)) return false;
    if (query.to && Date.parse(coordinate) >= Date.parse(query.to)) return false;
    return true;
  });
  if (scheduleQuery || upcomingQuery || historyQuery) return selected.slice(0, query.limit);
  return selected.slice(0, query.limit);
}
