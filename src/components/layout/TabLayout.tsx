import { Outlet } from 'react-router';

import { BottomNavigation } from '@/components/layout/BottomNavigation';

export function TabLayout() {
  return (
    <div className="grid h-full grid-rows-[minmax(0,1fr)_auto]">
      <div data-scroll-surface className="overflow-y-auto">
        <Outlet />
      </div>
      <BottomNavigation />
    </div>
  );
}
