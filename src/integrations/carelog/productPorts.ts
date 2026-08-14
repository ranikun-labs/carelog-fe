import type { CustomerEvent } from '@/domain/customerEvent';
import type { CustomerEventPort } from '@/integrations/carelog/customerEventPort';
import type { CarelogSessionProvider } from '@/integrations/carelog/httpClient';
import type { CustomerPort } from '@/integrations/carelog/customerPort';
import type { CustomerRecord } from '@/types/customer';

export interface ProductPorts {
  customerPort: CustomerPort;
  customerEventPort: CustomerEventPort;
}

export interface ProductPortCompositionOptions {
  initialCustomers?: readonly CustomerRecord[];
  initialEvents?: readonly CustomerEvent[];
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
  sessionProvider?: CarelogSessionProvider;
}
