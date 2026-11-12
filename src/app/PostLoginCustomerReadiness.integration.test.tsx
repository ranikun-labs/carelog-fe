import { useEffect } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';

import { AppRouter } from '@/app/AppRouter';
import { useAuth, type AuthContextValue } from '@/auth/AuthProvider';
import { AUTH_STATE } from '@/auth/authTypes';
import { createInMemoryAuthPort } from '@/auth/inMemoryAuthAdapter';
import {
  ProductionStateProviders,
  type ProductStateProviderProps,
} from '@/components/layout/ProductionStateProviders';
import { useCustomerStore, type CustomerStoreValue } from '@/state/CustomerStoreContext';
import type { CustomerRecord } from '@/types/customer';

const ports = vi.hoisted(() => ({ customers: vi.fn(), events: vi.fn() }));
vi.mock('@/integrations/carelog/productionComposition', () => ({
  createProductionProductPorts: () => ({
    customerPort: { list: ports.customers, get: vi.fn(), create: vi.fn(), edit: vi.fn() },
    customerEventPort: {
      list: ports.events,
      get: vi.fn(),
      create: vi.fn(),
      edit: vi.fn(),
      occur: vi.fn(),
      cancel: vi.fn(),
    },
  }),
}));
let current: { auth: AuthContextValue; customers: CustomerStoreValue; path: string };
function Observe() {
  const auth = useAuth();
  const customers = useCustomerStore();
  const path = useLocation().pathname;
  useEffect(() => {
    current = { auth, customers, path };
  }, [auth, customers, path]);
  return (
    <button onClick={() => void auth.login({ account: 'synthetic', secret: 'fixture' })}>
      test-login
    </button>
  );
}
function Providers({ children }: ProductStateProviderProps) {
  return (
    <ProductionStateProviders>
      <Observe />
      {children}
    </ProductionStateProviders>
  );
}
function mount() {
  return render(
    <MemoryRouter initialEntries={['/auth/login']}>
      <AppRouter
        authPort={createInMemoryAuthPort({ bootstrap: 'anonymous' })}
        stateProviders={Providers}
      />
    </MemoryRouter>,
  );
}
function pending() {
  let resolve!: (value: readonly CustomerRecord[]) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<readonly CustomerRecord[]>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function login() {
  await waitFor(() => expect(current.auth.authState.status).toBe(AUTH_STATE.ANONYMOUS));
  const previousReads = ports.customers.mock.calls.length;
  fireEvent.click(screen.getByRole('button', { name: 'test-login' }));
  await waitFor(() => expect(ports.customers).toHaveBeenCalledTimes(previousReads + 1));
}
const customer = { id: 'existing-customer', displayName: '기존 세션 고객' };
beforeEach(() => {
  ports.customers.mockReset().mockResolvedValue([]);
  ports.events.mockReset().mockResolvedValue([]);
});

it('waits for the real product port before deciding an existing user landing route', async () => {
  const read = pending();
  ports.customers.mockReturnValue(read.promise);
  mount();
  await login();
  expect(current.auth.authState.status).toBe(AUTH_STATE.AUTHENTICATED);
  expect(current.customers.loadState).toBe('loading');
  expect(current.path).toBe('/auth/login');
  expect(document.querySelector('[data-first-customer-cta]')).toBeNull();
  await act(async () => {
    read.resolve([customer]);
    await read.promise;
  });
  await waitFor(() => expect(current.path).toBe('/app/schedule'));
});

it('finishes pending loading and keeps the existing first-use route after an empty result', async () => {
  const read = pending();
  ports.customers.mockReturnValue(read.promise);
  mount();
  await login();
  expect(current.path).toBe('/auth/login');
  await act(async () => {
    read.resolve([]);
    await read.promise;
  });
  await waitFor(() => expect(current.path).toBe('/app/customers'));
  expect(document.querySelector('[data-customers-empty]')).toBeVisible();
  expect(document.querySelector('[data-first-customer-cta]')).toBeVisible();
});

it('retains the authenticated customer error/retry screen rather than waiting forever', async () => {
  const read = pending();
  ports.customers.mockReturnValue(read.promise);
  mount();
  await login();
  await act(async () => {
    read.reject(new Error('customer read unavailable'));
    await Promise.allSettled([read.promise]);
  });
  await waitFor(() => expect(current.path).toBe('/app/customers'));
  expect(current.auth.authState.status).toBe(AUTH_STATE.AUTHENTICATED);
  expect(current.customers.loadState).toBe('error');
  expect(screen.getByRole('button', { name: '다시 시도' })).toBeVisible();
  expect(document.querySelector('[data-customers-empty]')).toBeNull();
});

it.each(['resolve', 'reject'] as const)(
  'does not navigate from an old session read that later %ss',
  async (outcome) => {
    const old = pending(),
      next = pending();
    ports.customers.mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
    mount();
    await login();
    await act(async () => {
      await current.auth.logout();
    });
    await login();
    expect(ports.customers).toHaveBeenCalledTimes(2);
    await act(async () => {
      if (outcome === 'resolve') old.resolve([customer]);
      else old.reject(new Error('old session read failed'));
      await Promise.allSettled([old.promise]);
    });
    expect(current.auth.authState.status).toBe(AUTH_STATE.AUTHENTICATED);
    expect(current.path).toBe('/auth/login');
    expect(current.customers.loadState).toBe('loading');
    expect(current.customers.customers).toEqual([]);
    await act(async () => {
      next.resolve([]);
      await next.promise;
    });
    await waitFor(() => expect(current.path).toBe('/app/customers'));
    expect(current.customers.error).toBeNull();
  },
);
