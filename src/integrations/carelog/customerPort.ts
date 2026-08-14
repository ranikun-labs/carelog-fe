import type { CustomerRecord } from '@/types/customer';
import type { CustomerCreateInput, CustomerEditInput } from '@/state/customerStore';
import { CarelogProtocolError } from '@/integrations/carelog/errors';
import {
  mapCustomerResponse,
  toCustomerCreateBody,
  toCustomerEditBody,
} from '@/integrations/carelog/mappers';
import type { CarelogHttpClient } from '@/integrations/carelog/httpClient';

const CUSTOMERS_PATH = '/api/v1/users/customers';

export interface CustomerPort {
  list: () => Promise<readonly CustomerRecord[]>;
  get: (customerId: string) => Promise<CustomerRecord>;
  create: (input: CustomerCreateInput) => Promise<CustomerRecord>;
  edit: (
    customerId: string,
    current: CustomerRecord,
    input: CustomerEditInput,
  ) => Promise<CustomerRecord>;
}

export function createCarelogCustomerPort(client: CarelogHttpClient): CustomerPort {
  return {
    async list() {
      const payload = await client.get<unknown>(CUSTOMERS_PATH);
      if (!Array.isArray(payload)) {
        throw new CarelogProtocolError('Customer list response data is not an array.', payload);
      }
      return payload.map(mapCustomerResponse);
    },

    async get(customerId) {
      return mapCustomerResponse(await client.get<unknown>(customerPath(customerId)));
    },

    async create(input) {
      return mapCustomerResponse(
        await client.post<unknown>(CUSTOMERS_PATH, toCustomerCreateBody(input)),
      );
    },

    async edit(customerId, current, input) {
      return mapCustomerResponse(
        await client.patch<unknown>(customerPath(customerId), toCustomerEditBody(current, input)),
      );
    },
  };
}

function customerPath(customerId: string): string {
  return `${CUSTOMERS_PATH}/${encodeURIComponent(customerId)}`;
}
