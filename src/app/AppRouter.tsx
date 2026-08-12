import { Navigate, Route, Routes } from 'react-router';

import { AppShell } from '@/components/layout/AppShell';
import { PublicLayout } from '@/components/layout/PublicLayout';
import {
  APP_BASE,
  APP_ROUTE_PATHS,
  DEFAULT_LOCALE,
  PUBLIC_ROUTE_PATHS,
  buildPublicHomePath,
  toRelativeUnder,
} from '@/constants/routes';
import { AppNotFoundPage } from '@/pages/AppNotFoundPage';
import { CustomerCreatePage } from '@/pages/CustomerCreatePage';
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';
import { CustomerEditPage } from '@/pages/CustomerEditPage';
import { CustomerHandoffPage } from '@/pages/CustomerHandoffPage';
import { CustomerImportPage } from '@/pages/CustomerImportPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { FollowUpsPage } from '@/pages/FollowUpsPage';
import { ReviewDetailPage } from '@/pages/ReviewDetailPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { EventDetailPage } from '@/pages/EventDetailPage';
import { SchedulePage } from '@/pages/SchedulePage';
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
        <Route index element={<SchedulePage />} />
        <Route
          path={toRelativeUnder(APP_BASE, APP_ROUTE_PATHS.schedule)}
          element={<SchedulePage />}
        />
        <Route
          path={toRelativeUnder(APP_BASE, APP_ROUTE_PATHS.customers)}
          element={<CustomersPage />}
        />
        <Route
          path={toRelativeUnder(APP_BASE, APP_ROUTE_PATHS.customerCreate)}
          element={<CustomerCreatePage />}
        />
        <Route
          path={toRelativeUnder(APP_BASE, APP_ROUTE_PATHS.customerEdit)}
          element={<CustomerEditPage />}
        />
        <Route
          path={toRelativeUnder(APP_BASE, APP_ROUTE_PATHS.customerDetail)}
          element={<CustomerDetailPage />}
        />
        <Route
          path={toRelativeUnder(APP_BASE, APP_ROUTE_PATHS.followUps)}
          element={<FollowUpsPage />}
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
        <Route
          path={toRelativeUnder(APP_BASE, APP_ROUTE_PATHS.eventDetail)}
          element={<EventDetailPage />}
        />
        <Route path="*" element={<AppNotFoundPage />} />
      </Route>
      <Route path="*" element={<PublicNotFoundPage />} />
    </Routes>
  );
}
