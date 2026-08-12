import type { CustomerEvent } from '@/domain/customerEvent';
import type { CustomerRecord } from '@/types/customer';

export interface AppInitialization {
  initialCustomers?: readonly CustomerRecord[];
  initialEvents?: readonly CustomerEvent[];
}
