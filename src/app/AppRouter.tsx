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
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';
import { CustomerHandoffPage } from '@/pages/CustomerHandoffPage';
import { CustomerImportPage } from '@/pages/CustomerImportPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { FollowUpsPage } from '@/pages/FollowUpsPage';
import { ReviewDetailPage } from '@/pages/ReviewDetailPage';
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
          <Route
            path={toRelativeUnder(APP_BASE, APP_ROUTE_PATHS.customers)}
            element={<CustomersPage />}
          />
          <Route
            path={toRelativeUnder(APP_BASE, APP_ROUTE_PATHS.followUps)}
            element={<FollowUpsPage />}
          />
        </Route>
        <Route
          path={toRelativeUnder(APP_BASE, APP_ROUTE_PATHS.customerDetail)}
          element={<CustomerDetailPage />}
        />
        <Route
          path={toRelativeUnder(APP_BASE, APP_ROUTE_PATHS.customerImport)}
          element={<CustomerImportPage />}
        />
        <Route
          path={toRelativeUnder(APP_BASE, APP_ROUTE_PATHS.customerHandoff)}
          element={<CustomerHandoffPage />}
        />
        <Route
          path={toRelativeUnder(APP_BASE, APP_ROUTE_PATHS.reviewDetail)}
          element={<ReviewDetailPage />}
        />
        <Route
          path={toRelativeUnder(APP_BASE, APP_ROUTE_PATHS.settings)}
          element={<SettingsPage />}
        />
        <Route path="*" element={<AppNotFoundPage />} />
      </Route>
      <Route path="*" element={<PublicNotFoundPage />} />
    </Routes>
  );
}
