import {
  createCarelogCustomerEventPort,
  type CustomerEventPort,
} from '@/integrations/carelog/customerEventPort';
import { CarelogConfigurationError } from '@/integrations/carelog/errors';
import { createCarelogHttpClient, type CarelogHttpClient } from '@/integrations/carelog/httpClient';
import { createCarelogCustomerPort, type CustomerPort } from '@/integrations/carelog/customerPort';
import { getProductionCarelogAuthRuntime } from '@/integrations/carelog/productionAuthRuntime';
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
  const runtime = getProductionCarelogAuthRuntime();
  const apiBaseUrl = options.apiBaseUrl ?? runtime.apiBaseUrl;
  if (!apiBaseUrl) {
    return createUnavailablePorts();
  }

  let client: CarelogHttpClient;
  try {
    client = createCarelogHttpClient({
      baseUrl: apiBaseUrl,
      fetchImpl: options.fetchImpl,
      sessionProvider: options.sessionProvider ?? runtime.sessionProvider,
      onUnauthorized: options.onUnauthorized,
    });
  } catch (error) {
    return createUnavailablePorts(error);
  }

  return {
    customerPort: createCarelogCustomerPort(client),
    customerEventPort: createCarelogCustomerEventPort(client),
  };
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
