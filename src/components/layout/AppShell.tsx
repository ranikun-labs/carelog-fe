import type { AppInitialization } from '@/app/appInitialization';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';

import { AuthOperationErrorSurface } from '@/components/auth/AuthStatusSurface';
import { AuthRecoveryBanner } from '@/components/auth/AuthStatusSurface';
import { AUTH_STATE } from '@/auth/authTypes';
import { AdaptiveHost } from '@/components/layout/AdaptiveHost';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { SideNavigationRail } from '@/components/layout/SideNavigationRail';
import { AppLocaleProvider } from '@/i18n/AppLocaleProvider';
import { CustomerFormDraftProvider } from '@/state/CustomerFormDraftContext';
import { CustomerStoreProvider, useOptionalCustomerStore } from '@/state/CustomerStoreContext';
import { EventCreateDraftProvider } from '@/state/EventCreateDraftContext';
import { EventStoreProvider } from '@/state/EventStoreContext';
import { useOptionalEventStore } from '@/state/EventStoreContext';
import { ScheduleActivationGuardProvider } from '@/state/ScheduleActivationGuardContext';
import { useOptionalAuth } from '@/auth/AuthProvider';

export function ProductStateProviders({
  children,
  initialCustomers,
  initialEvents,
}: AppInitialization & { children: ReactNode }) {
  const location = useLocation();

  return (
    <CustomerStoreProvider initialCustomers={initialCustomers}>
      <EventStoreProvider initialEvents={initialEvents}>
        <ScheduleActivationGuardProvider>
          <CustomerFormDraftProvider key={location.pathname}>
            <EventCreateDraftProvider>{children}</EventCreateDraftProvider>
          </CustomerFormDraftProvider>
        </ScheduleActivationGuardProvider>
      </EventStoreProvider>
    </CustomerStoreProvider>
  );
}

export function AppShellFrame() {
  const auth = useOptionalAuth();

  return (
    <div data-app-shell className="bg-page flex h-dvh w-full flex-col overflow-hidden">
      {auth?.operationError ? (
        <AuthOperationErrorSurface
          failure={auth.operationError.failure}
          onRetry={auth.operationError.retry ? () => void auth.retryOperation() : undefined}
          onDismiss={auth.clearOperationError}
        />
      ) : null}
      {auth?.authState.status === AUTH_STATE.RECOVERING ? <AuthRecoveryBanner /> : null}
      <div data-app-host className="bg-page min-h-0 w-full flex-1 overflow-hidden">
        <div data-app-frame className="flex h-full w-full min-w-0">
          <SideNavigationRail />
          <div
            data-app-content
            className="bg-surface flex h-full min-w-0 flex-1 flex-col overflow-hidden"
          >
            <AdaptiveHost />
            <BottomNavigation />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Standalone shell export retained for component-level tests and embedders. */
export function AppShell({ initialCustomers, initialEvents }: AppInitialization = {}) {
  const customerStore = useOptionalCustomerStore();
  const eventStore = useOptionalEventStore();
  const frame = <AppShellFrame />;
  const content =
    customerStore && eventStore ? (
      frame
    ) : (
      <ProductStateProviders initialCustomers={initialCustomers} initialEvents={initialEvents}>
        {frame}
      </ProductStateProviders>
    );

  return <AppLocaleProvider>{content}</AppLocaleProvider>;
}
