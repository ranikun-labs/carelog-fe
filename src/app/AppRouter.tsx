import { Navigate, Route, Routes } from 'react-router';

import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { AUTH_STATE, type AuthPort } from '@/auth/authTypes';
import { resolvePostAuthPath } from '@/auth/postAuthRouting';
import type { AppInitialization } from '@/app/appInitialization';
import { AppShellFrame } from '@/components/layout/AppShell';
import {
  ProductionStateProviders,
  type ProductStateProvider,
} from '@/components/layout/ProductionStateProviders';
import {
  AuthBootstrapErrorScreen,
  AuthBootstrapScreen,
  AuthRecoveryScreen,
} from '@/components/auth/AuthStatusSurface';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';
import { AppLocaleProvider } from '@/i18n/AppLocaleProvider';
import {
  APP_BASE,
  APP_ROUTE_PATHS,
  AUTH_BASE,
  AUTH_ROUTE_PATHS,
  DEFAULT_LOCALE,
  PUBLIC_ROUTE_PATHS,
  buildAuthEntryPath,
  buildPublicHomePath,
  toRelativeUnder,
} from '@/constants/routes';
import { AuthEntryPage } from '@/pages/auth/AuthEntryPage';
import { AuthFormPage } from '@/pages/auth/AuthFormPage';
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
import { EventCreatePage } from '@/pages/EventCreatePage';
import { SchedulePage } from '@/pages/SchedulePage';
import { FeaturesPage } from '@/pages/public/FeaturesPage';
import { PublicHomePage } from '@/pages/public/PublicHomePage';
import { PublicNotFoundPage } from '@/pages/public/PublicNotFoundPage';
import { useCustomerStore } from '@/state/CustomerStoreContext';

function ProtectedAppBoundary() {
  const auth = useAuth();

  switch (auth.authState.status) {
    case AUTH_STATE.BOOTSTRAPPING:
      return <AuthBootstrapScreen />;
    case AUTH_STATE.RECOVERING:
      return <AppShellFrame />;
    case AUTH_STATE.ERROR:
      return <AuthBootstrapErrorScreen onRetry={auth.retryBootstrap} />;
    case AUTH_STATE.ANONYMOUS: {
      return <Navigate replace to={buildAuthEntryPath()} />;
    }
    case AUTH_STATE.AUTHENTICATED:
      return <AppShellFrame />;
  }
}

function AuthRouteBoundary() {
  const auth = useAuth();
  const customerCount = useCustomerStore().customers.length;

  switch (auth.authState.status) {
    case AUTH_STATE.BOOTSTRAPPING:
      return <AuthBootstrapScreen />;
    case AUTH_STATE.RECOVERING:
      return <AuthRecoveryScreen />;
    case AUTH_STATE.ERROR:
      return <AuthBootstrapErrorScreen onRetry={auth.retryBootstrap} />;
    case AUTH_STATE.AUTHENTICATED:
      return <Navigate replace to={resolvePostAuthPath(customerCount)} />;
    case AUTH_STATE.ANONYMOUS:
      return <AuthLayout />;
  }
}

function AppRoutes() {
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
      <Route path={AUTH_BASE} element={<AuthRouteBoundary />}>
        <Route index element={<Navigate replace to={AUTH_ROUTE_PATHS.entry} />} />
        <Route
          path={toRelativeUnder(AUTH_BASE, AUTH_ROUTE_PATHS.entry)}
          element={<AuthEntryPage />}
        />
        <Route
          path={toRelativeUnder(AUTH_BASE, AUTH_ROUTE_PATHS.login)}
          element={<AuthFormPage mode="login" />}
        />
        <Route
          path={toRelativeUnder(AUTH_BASE, AUTH_ROUTE_PATHS.signup)}
          element={<AuthFormPage mode="signup" />}
        />
        <Route path="*" element={<AuthEntryPage />} />
      </Route>
      <Route path={APP_BASE} element={<ProtectedAppBoundary />}>
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
          path={toRelativeUnder(APP_BASE, APP_ROUTE_PATHS.eventCreate)}
          element={<EventCreatePage />}
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

export function AppRouter({
  initialCustomers,
  initialEvents,
  authPort,
  stateProviders,
}: AppInitialization & { authPort?: AuthPort; stateProviders?: ProductStateProvider } = {}) {
  const StateProviders = stateProviders ?? ProductionStateProviders;
  return (
    <AppLocaleProvider>
      <AuthProvider authPort={authPort}>
        <StateProviders {...(stateProviders ? { initialCustomers, initialEvents } : {})}>
          <AppRoutes />
        </StateProviders>
      </AuthProvider>
    </AppLocaleProvider>
  );
}
