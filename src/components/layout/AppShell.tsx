import { AdaptiveHost } from '@/components/layout/AdaptiveHost';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { SideNavigationRail } from '@/components/layout/SideNavigationRail';
import { AppLocaleProvider } from '@/i18n/AppLocaleProvider';
import { EventStoreProvider } from '@/state/EventStoreContext';

export function AppShell() {
  return (
    <AppLocaleProvider>
      <EventStoreProvider>
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
    </AppLocaleProvider>
  );
}
