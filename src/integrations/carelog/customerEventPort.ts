import type {
  CustomerEvent,
  CustomerEventEdit,
  CreateOccurredCustomerEventInput,
  CreatePlannedCustomerEventInput,
} from '@/domain/customerEvent';
import type { CarelogHttpClient } from '@/integrations/carelog/httpClient';
import { CarelogProtocolError } from '@/integrations/carelog/errors';
import {
  mapCustomerEventResponse,
  toCustomerEventCreateBody,
  toCustomerEventPatchBody,
} from '@/integrations/carelog/mappers';
import type { CarelogTimeRange } from '@/integrations/carelog/timeRange';

const EVENTS_PATH = '/api/v1/customer-events';

export type CustomerEventCreationInput =
  | (CreatePlannedCustomerEventInput & { status: 'PLANNED' })
  | (CreateOccurredCustomerEventInput & { status: 'OCCURRED' });

export interface CustomerEventListQuery {
  customerId?: string;
  from?: string;
  to?: string;
  limit: number;
}

export interface CustomerEventPort {
  list: (query: CustomerEventListQuery) => Promise<readonly CustomerEvent[]>;
  get: (eventId: string) => Promise<CustomerEvent>;
  create: (input: CustomerEventCreationInput) => Promise<CustomerEvent>;
  edit: (current: CustomerEvent, changes: CustomerEventEdit) => Promise<CustomerEvent>;
  occur: (eventId: string, occurredAt: string) => Promise<CustomerEvent>;
  cancel: (eventId: string) => Promise<CustomerEvent>;
}

export function createCarelogCustomerEventPort(client: CarelogHttpClient): CustomerEventPort {
  return {
    async list(query) {
      validateListQuery(query);
      const params = new URLSearchParams({ limit: String(query.limit) });
      if (query.customerId) params.set('customerId', query.customerId);
      if (query.from) params.set('from', query.from);
      if (query.to) params.set('to', query.to);
      const payload = await client.get<unknown>(`${EVENTS_PATH}?${params.toString()}`);
      if (!Array.isArray(payload)) {
        throw new CarelogProtocolError(
          'CustomerEvent list response data is not an array.',
          payload,
        );
      }
      return payload.map(mapCustomerEventResponse);
    },

    async get(eventId) {
      return mapCustomerEventResponse(await client.get<unknown>(eventPath(eventId)));
    },

    async create(input) {
      return mapCustomerEventResponse(
        await client.post<unknown>(EVENTS_PATH, toCustomerEventCreateBody(input)),
      );
    },

    async edit(current, changes) {
      return mapCustomerEventResponse(
        await client.patch<unknown>(
          eventPath(current.id),
          toCustomerEventPatchBody(current, changes),
        ),
      );
    },

    async occur(eventId, occurredAt) {
      return mapCustomerEventResponse(
        await client.post<unknown>(`${eventPath(eventId)}/occur`, { occurredAt }),
      );
    },

    async cancel(eventId) {
      return mapCustomerEventResponse(await client.post<unknown>(`${eventPath(eventId)}/cancel`));
    },
  };
}

export function createScheduleQuery(range: CarelogTimeRange, limit = 100): CustomerEventListQuery {
  return { from: range.from, to: range.to, limit };
}

export function createCustomerUpcomingQuery(
  customerId: string,
  range: CarelogTimeRange,
  limit = 100,
): CustomerEventListQuery {
  return { customerId, from: range.from, to: range.to, limit };
}

export function createCustomerHistoryQuery(customerId: string, limit = 50): CustomerEventListQuery {
  return { customerId, limit };
}

function eventPath(eventId: string): string {
  return `${EVENTS_PATH}/${encodeURIComponent(eventId)}`;
}

function validateListQuery(query: CustomerEventListQuery): void {
  if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100) {
    throw new CarelogProtocolError('CustomerEvent list limit must be between 1 and 100.', query);
  }
  const hasFrom = query.from !== undefined;
  const hasTo = query.to !== undefined;
  if (hasFrom !== hasTo) {
    throw new CarelogProtocolError(
      'CustomerEvent list range must include both from and to.',
      query,
    );
  }
  if (!query.customerId && !hasFrom) {
    throw new CarelogProtocolError('CustomerEvent list must be bounded or customer-scoped.', query);
  }
}
