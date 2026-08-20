import type { CustomerEvent } from '@/domain/customerEvent';
import type { AssistantAdapter } from '@/assistant/assistantAdapter';
import type { CustomerRecord } from '@/types/customer';

export interface AppInitialization {
  initialCustomers?: readonly CustomerRecord[];
  initialEvents?: readonly CustomerEvent[];
  /** Explicit prototype/test seam; production does not provide a default adapter. */
  assistantAdapter?: AssistantAdapter;
}
