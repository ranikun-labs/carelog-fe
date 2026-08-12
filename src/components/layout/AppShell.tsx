import type { AppInitialization } from '@/app/appInitialization';
import { useLocation } from 'react-router';

import { AdaptiveHost } from '@/components/layout/AdaptiveHost';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { SideNavigationRail } from '@/components/layout/SideNavigationRail';
import { AppLocaleProvider } from '@/i18n/AppLocaleProvider';
import { CustomerFormDraftProvider } from '@/state/CustomerFormDraftContext';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';
import { EventStoreProvider } from '@/state/EventStoreContext';

export function AppShell({ initialCustomers, initialEvents }: AppInitialization = {}) {
  const location = useLocation();

  return (
    <AppLocaleProvider>
      <CustomerStoreProvider initialCustomers={initialCustomers}>
        <EventStoreProvider initialEvents={initialEvents}>
          <CustomerFormDraftProvider key={location.pathname}>
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
          </CustomerFormDraftProvider>
        </EventStoreProvider>
      </CustomerStoreProvider>
    </AppLocaleProvider>
  );
}
