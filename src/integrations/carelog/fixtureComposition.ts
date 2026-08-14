import {
  createFixtureCustomerEventPort,
  createFixtureCustomerPort,
} from '@/integrations/carelog/fixturePorts';
import type {
  ProductPortCompositionOptions,
  ProductPorts,
} from '@/integrations/carelog/productPorts';

export type {
  ProductPortCompositionOptions,
  ProductPorts,
} from '@/integrations/carelog/productPorts';

export function createFixtureProductPorts(
  options: Pick<ProductPortCompositionOptions, 'initialCustomers' | 'initialEvents'> = {},
): ProductPorts {
  return {
    customerPort: createFixtureCustomerPort(options.initialCustomers),
    customerEventPort: createFixtureCustomerEventPort(options.initialEvents),
  };
}
