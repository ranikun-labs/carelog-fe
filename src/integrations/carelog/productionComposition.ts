import {
  createCarelogCustomerEventPort,
  type CustomerEventPort,
} from '@/integrations/carelog/customerEventPort';
import { CarelogConfigurationError } from '@/integrations/carelog/errors';
import { createCarelogHttpClient, type CarelogHttpClient } from '@/integrations/carelog/httpClient';
import { createCarelogCustomerPort, type CustomerPort } from '@/integrations/carelog/customerPort';
import type {
  ProductPortCompositionOptions,
  ProductPorts,
} from '@/integrations/carelog/productPorts';

export type {
  ProductPortCompositionOptions,
  ProductPorts,
} from '@/integrations/carelog/productPorts';

export function createProductionProductPorts(
  options: ProductPortCompositionOptions = {},
): ProductPorts {
  const apiBaseUrl = options.apiBaseUrl ?? readCarelogApiBaseUrl();
  if (!apiBaseUrl) {
    return createUnavailablePorts();
  }

  let client: CarelogHttpClient;
  try {
    client = createCarelogHttpClient({
      baseUrl: apiBaseUrl,
      fetchImpl: options.fetchImpl,
      sessionProvider: options.sessionProvider ?? { credentials: 'include' },
    });
  } catch (error) {
    return createUnavailablePorts(error);
  }

  return {
    customerPort: createCarelogCustomerPort(client),
    customerEventPort: createCarelogCustomerEventPort(client),
  };
}

function readCarelogApiBaseUrl(): string | undefined {
  const value = import.meta.env.VITE_CARELOG_API_BASE_URL;
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function createUnavailablePorts(reason?: unknown): ProductPorts {
  const fail = async (): Promise<never> => {
    if (reason instanceof CarelogConfigurationError) throw reason;
    throw new CarelogConfigurationError(
      'VITE_CARELOG_API_BASE_URL is required for the production Carelog composition.',
    );
  };
  return {
    customerPort: { list: fail, get: fail, create: fail, edit: fail },
    customerEventPort: {
      list: fail,
      get: fail,
      create: fail,
      edit: fail,
      occur: fail,
      cancel: fail,
    },
  };
}

export type { CustomerEventPort, CustomerPort };
