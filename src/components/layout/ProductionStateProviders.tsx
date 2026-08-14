import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { useLocation } from 'react-router';

import { useOptionalAuth } from '@/auth/AuthProvider';
import { CustomerFormDraftProvider } from '@/state/CustomerFormDraftContext';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';
import { EventCreateDraftProvider } from '@/state/EventCreateDraftContext';
import { EventStoreProvider } from '@/state/EventStoreContext';
import { createProductionProductPorts } from '@/integrations/carelog/productionComposition';
import { toAuthFailure } from '@/integrations/carelog/errorMapping';
import type { CustomerEvent } from '@/domain/customerEvent';
import type { CustomerRecord } from '@/types/customer';

export interface ProductStateProviderProps {
  children: ReactNode;
  initialCustomers?: readonly CustomerRecord[];
  initialEvents?: readonly CustomerEvent[];
}

export type ProductStateProvider = (props: ProductStateProviderProps) => ReactNode;

export function ProductionStateProviders({ children }: ProductStateProviderProps) {
  const location = useLocation();
  const auth = useOptionalAuth();
  const ports = useMemo(() => createProductionProductPorts(), []);
  const onFailure = useMemo(
    () => (error: unknown) => {
      const failure = toAuthFailure(error);
      if (failure) auth?.reportFailure(failure);
    },
    [auth],
  );

  return (
    <CustomerStoreProvider port={ports.customerPort} onFailure={onFailure}>
      <EventStoreProvider port={ports.customerEventPort} onFailure={onFailure}>
        <CustomerFormDraftProvider key={location.pathname}>
          <EventCreateDraftProvider>{children}</EventCreateDraftProvider>
        </CustomerFormDraftProvider>
      </EventStoreProvider>
    </CustomerStoreProvider>
  );
}
