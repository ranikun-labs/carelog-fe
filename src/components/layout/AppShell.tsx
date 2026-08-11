import { Outlet } from 'react-router';

import { SideNavigationRail } from '@/components/layout/SideNavigationRail';
import { AppLocaleProvider } from '@/i18n/AppLocaleProvider';

export function AppShell() {
  return (
    <AppLocaleProvider>
      <div
        data-app-host
        className="bg-page h-dvh w-full overflow-hidden [--carelog-legacy-content-max:100%] md:[--carelog-legacy-content-max:520px] lg:[--carelog-legacy-content-max:560px]"
      >
        <div
          data-app-frame
          className="mx-auto flex h-full w-full md:max-w-[600px] lg:max-w-[640px]"
        >
          <SideNavigationRail />
          <div
            data-app-content
            className="bg-surface h-full w-full max-w-[var(--carelog-legacy-content-max)] min-w-0 flex-1 overflow-hidden md:w-[var(--carelog-legacy-content-max)] md:flex-none"
          >
            <Outlet />
          </div>
        </div>
      </div>
    </AppLocaleProvider>
  );
}
