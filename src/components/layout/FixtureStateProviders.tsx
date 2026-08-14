import { useMemo } from 'react';
import { useLocation } from 'react-router';

import { useOptionalAuth } from '@/auth/AuthProvider';
import { CUSTOMER_FIXTURE_RECORDS } from '@/fixtures/scenarios';
import { SCHEDULE_FIXTURE } from '@/fixtures/schedule';
import { toAuthFailure } from '@/integrations/carelog/errorMapping';
import { createFixtureProductPorts } from '@/integrations/carelog/fixtureComposition';
import { CustomerFormDraftProvider } from '@/state/CustomerFormDraftContext';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';
import { EventCreateDraftProvider } from '@/state/EventCreateDraftContext';
import { EventStoreProvider } from '@/state/EventStoreContext';
import type { ProductStateProviderProps } from '@/components/layout/ProductionStateProviders';

export function FixtureStateProviders({
  children,
  initialCustomers,
  initialEvents,
}: ProductStateProviderProps) {
  const location = useLocation();
  const auth = useOptionalAuth();
  const ports = useMemo(
    () => createFixtureProductPorts({ initialCustomers, initialEvents }),
    [initialCustomers, initialEvents],
  );
  const onFailure = useMemo(
    () => (error: unknown) => {
      const failure = toAuthFailure(error);
      if (failure) auth?.reportFailure(failure);
    },
    [auth],
  );

  return (
    <CustomerStoreProvider
      initialCustomers={initialCustomers ?? CUSTOMER_FIXTURE_RECORDS}
      port={ports.customerPort}
      onFailure={onFailure}
      remoteReadsEnabled={false}
    >
      <EventStoreProvider
        initialEvents={initialEvents ?? SCHEDULE_FIXTURE.events}
        port={ports.customerEventPort}
        onFailure={onFailure}
      >
        <CustomerFormDraftProvider key={location.pathname}>
          <EventCreateDraftProvider>{children}</EventCreateDraftProvider>
        </CustomerFormDraftProvider>
      </EventStoreProvider>
    </CustomerStoreProvider>
  );
}
