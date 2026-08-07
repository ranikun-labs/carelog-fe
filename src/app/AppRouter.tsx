import { Navigate, Route, Routes } from 'react-router';

import { AppShell } from '@/components/layout/AppShell';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { TabLayout } from '@/components/layout/TabLayout';
import {
  APP_BASE,
  APP_ROUTE_PATHS,
  DEFAULT_LOCALE,
  PUBLIC_ROUTE_PATHS,
  buildPublicHomePath,
  toRelativeUnder,
} from '@/constants/routes';
import { AppHomePage } from '@/pages/AppHomePage';
import { AppNotFoundPage } from '@/pages/AppNotFoundPage';
import { ItemDetailPage } from '@/pages/ItemDetailPage';
import { ItemsPage } from '@/pages/ItemsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { FeaturesPage } from '@/pages/public/FeaturesPage';
import { PublicHomePage } from '@/pages/public/PublicHomePage';
import { PublicNotFoundPage } from '@/pages/public/PublicNotFoundPage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to={buildPublicHomePath(DEFAULT_LOCALE)} />} />
      <Route path={PUBLIC_ROUTE_PATHS.localeHome} element={<PublicLayout />}>
        <Route index element={<PublicHomePage />} />
        <Route
          path={toRelativeUnder(PUBLIC_ROUTE_PATHS.localeHome, PUBLIC_ROUTE_PATHS.features)}
          element={<FeaturesPage />}
        />
        <Route path="*" element={<PublicNotFoundPage />} />
      </Route>
      <Route path={APP_BASE} element={<AppShell />}>
        <Route element={<TabLayout />}>
          <Route index element={<AppHomePage />} />
          <Route path={toRelativeUnder(APP_BASE, APP_ROUTE_PATHS.items)} element={<ItemsPage />} />
          <Route
            path={toRelativeUnder(APP_BASE, APP_ROUTE_PATHS.settings)}
            element={<SettingsPage />}
          />
          <Route
            path={toRelativeUnder(APP_BASE, APP_ROUTE_PATHS.itemDetail)}
            element={<ItemDetailPage />}
          />
        </Route>
        <Route path="*" element={<AppNotFoundPage />} />
      </Route>
      <Route path="*" element={<PublicNotFoundPage />} />
    </Routes>
  );
}
