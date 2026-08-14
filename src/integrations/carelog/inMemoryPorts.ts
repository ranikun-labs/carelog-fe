import type { CustomerEvent, CustomerEventEdit } from '@/domain/customerEvent';
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
import type {
  CustomerEventCreationInput,
  CustomerEventListQuery,
  CustomerEventPort,
} from '@/integrations/carelog/customerEventPort';
import type { CustomerPort } from '@/integrations/carelog/customerPort';
import type { CustomerRecord } from '@/types/customer';

export function createInMemoryCustomerPort(
  initialCustomers: readonly CustomerRecord[] = [],
): CustomerPort {
  let customers = [...initialCustomers];
  return {
    list: async () => customers,
    get: async (customerId) => {
      const customer = customers.find((candidate) => candidate.id === customerId);
      if (!customer) throw new Error(`In-memory customer not found: ${customerId}`);
      return customer;
    },
    create: async (input: CustomerCreateInput) => {
      const customer = buildCreatedCustomer(createCustomerId(customers), input);
      if (!customer) throw new Error('Customer name is required.');
      customers = [...customers, customer];
      return customer;
    },
    edit: async (customerId: string, _current: CustomerRecord, input: CustomerEditInput) => {
      const updated = editCustomerById(customers, customerId, input);
      if (!updated) throw new Error(`In-memory customer not found: ${customerId}`);
      customers = customers.map((candidate) => (candidate.id === customerId ? updated : candidate));
      return updated;
    },
  };
}

export function createInMemoryCustomerEventPort(
  initialEvents: readonly CustomerEvent[] = [],
): CustomerEventPort {
  let events = [...initialEvents];
  return {
    list: async (query) => filterEvents(events, query),
    get: async (eventId) => {
      const event = events.find((candidate) => candidate.id === eventId);
      if (!event) throw new Error(`In-memory event not found: ${eventId}`);
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
    edit: async (current: CustomerEvent, changes: CustomerEventEdit) => {
      const event = editEventById(events, current.id, changes);
      if (!event) throw new Error(`In-memory event not found: ${current.id}`);
      events = events.map((candidate) => (candidate.id === event.id ? event : candidate));
      return event;
    },
    occur: async (eventId, occurredAt) => {
      const event = occurEventById(events, eventId, occurredAt);
      if (!event) throw new Error(`In-memory event cannot occur: ${eventId}`);
      events = events.map((candidate) => (candidate.id === event.id ? event : candidate));
      return event;
    },
    cancel: async (eventId) => {
      const event = cancelEventById(events, eventId);
      if (!event) throw new Error(`In-memory event cannot cancel: ${eventId}`);
      events = events.map((candidate) => (candidate.id === event.id ? event : candidate));
      return event;
    },
  };
}

function filterEvents(
  events: readonly CustomerEvent[],
  query: CustomerEventListQuery,
): readonly CustomerEvent[] {
  return events
    .filter((event) => {
      if (query.customerId && event.customerId !== query.customerId) return false;
      const coordinate = event.status === 'OCCURRED' ? event.occurredAt : event.scheduledAt;
      if (query.from && Date.parse(coordinate) < Date.parse(query.from)) return false;
      if (query.to && Date.parse(coordinate) >= Date.parse(query.to)) return false;
      return true;
    })
    .slice(0, query.limit);
}
