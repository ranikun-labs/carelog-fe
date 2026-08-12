import { useMemo } from 'react';
import { useLocation } from 'react-router';

import { AdaptiveHost } from '@/components/layout/AdaptiveHost';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { SideNavigationRail } from '@/components/layout/SideNavigationRail';
import { AppLocaleProvider } from '@/i18n/AppLocaleProvider';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';
import { EventStoreProvider } from '@/state/EventStoreContext';

export function AppShell() {
  const location = useLocation();
  const isEmptyCustomerSeed = useMemo(
    () => new URLSearchParams(location.search).get('customerSeed') === 'empty',
    [location.search],
  );

  return (
    <AppLocaleProvider>
      <CustomerStoreProvider initialCustomers={isEmptyCustomerSeed ? [] : undefined}>
        <EventStoreProvider initialEvents={isEmptyCustomerSeed ? [] : undefined}>
          <div data-app-host className="bg-page h-dvh w-full overflow-hidden">
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
        </EventStoreProvider>
      </CustomerStoreProvider>
    </AppLocaleProvider>
  );
}
