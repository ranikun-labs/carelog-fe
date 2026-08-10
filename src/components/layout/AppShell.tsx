import { Outlet } from 'react-router';

import { AppLocaleProvider } from '@/i18n/AppLocaleProvider';

export function AppShell() {
  return (
    <AppLocaleProvider>
      <div
        data-app-host
        className="bg-page h-dvh w-full overflow-hidden [--carelog-legacy-content-max:480px]"
      >
        <div
          data-app-content
          className="bg-surface mx-auto h-full w-full max-w-[var(--carelog-legacy-content-max)] overflow-hidden"
        >
          <Outlet />
        </div>
      </div>
    </AppLocaleProvider>
  );
}
