import { Outlet } from 'react-router';

import { AppLocaleProvider } from '@/i18n/AppLocaleProvider';

export function AppShell() {
  return (
    <AppLocaleProvider>
      <div className="bg-background mx-auto h-dvh w-full max-w-[480px] overflow-hidden shadow-xl">
        <Outlet />
      </div>
    </AppLocaleProvider>
  );
}
