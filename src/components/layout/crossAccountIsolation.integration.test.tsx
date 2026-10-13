import { useEffect } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';

import { AppRouter } from '@/app/AppRouter';
import { createInMemoryAuthPort } from '@/auth/inMemoryAuthAdapter';
import { AuthProvider, useAuth, type AuthContextValue } from '@/auth/AuthProvider';
import {
  AUTH_ERROR_KIND,
  type AuthBootstrapResult,
  type AuthCommandResult,
  type AuthPort,
} from '@/auth/authTypes';
import type { CustomerEvent } from '@/domain/customerEvent';
import { CarelogHttpError } from '@/integrations/carelog/errors';
import { useCustomerStore, type CustomerStoreValue } from '@/state/CustomerStoreContext';
import { useEventStore, type EventStoreValue } from '@/state/EventStoreContext';
import { useOptionalCustomerFormDraft } from '@/state/CustomerFormDraftContext';
import { useEventCreateDraft } from '@/state/EventCreateDraftContext';
import {
  EventCreateActivationProvider,
  useEventCreateActivation,
} from '@/state/EventCreateActivationContext';
import type { CustomerRecord } from '@/types/customer';

const mocks = vi.hoisted(() => ({ compose: vi.fn() }));
vi.mock('@/integrations/carelog/productionComposition', () => ({
  createProductionProductPorts: mocks.compose,
}));
import { ProductionStateProviders } from '@/components/layout/ProductionStateProviders';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const customerA: CustomerRecord = { id: 'synthetic-a', displayName: 'Synthetic A' };
const customerB: CustomerRecord = { id: 'synthetic-b', displayName: 'Synthetic B' };
const eventA: Extract<CustomerEvent, { status: 'PLANNED' }> = {
  id: 'synthetic-event-a',
  customerId: customerA.id,
  status: 'PLANNED',
  scheduledAt: '2026-10-13T10:00:00+09:00',
};
const range = { from: '2026-10-13T00:00:00+09:00', to: '2026-10-14T00:00:00+09:00' };
let auth: AuthContextValue;
let customers: CustomerStoreValue;
let events: EventStoreValue;
let customerDraft: NonNullable<ReturnType<typeof useOptionalCustomerFormDraft>>;
let eventDraft: ReturnType<typeof useEventCreateDraft>;
let activation: ReturnType<typeof useEventCreateActivation>;
let navigate: ReturnType<typeof useNavigate>;
function Probe() {
  const nextAuth = useAuth();
  const nextCustomers = useCustomerStore();
  const nextEvents = useEventStore();
  const nextCustomerDraft = useOptionalCustomerFormDraft()!;
  const nextEventDraft = useEventCreateDraft();
  const nextActivation = useEventCreateActivation();
  const nextNavigate = useNavigate();
  useEffect(() => {
    auth = nextAuth;
    customers = nextCustomers;
    events = nextEvents;
    customerDraft = nextCustomerDraft;
    eventDraft = nextEventDraft;
    activation = nextActivation;
    navigate = nextNavigate;
  }, [
    nextAuth,
    nextCustomers,
    nextEvents,
    nextCustomerDraft,
    nextEventDraft,
    nextActivation,
    nextNavigate,
  ]);
  return (
    <output>
      {JSON.stringify({
        customers: nextCustomers.customers,
        events: nextEvents.events,
        customerDraft: nextCustomerDraft.getDraft('create'),
        eventDraft: nextEventDraft.draft,
      })}
    </output>
  );
}
const customerPort = { list: vi.fn(), get: vi.fn(), create: vi.fn(), edit: vi.fn() };
const eventPort = {
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  edit: vi.fn(),
  occur: vi.fn(),
  cancel: vi.fn(),
};
function renderSession(overrides: Partial<AuthPort> = {}) {
  const port: AuthPort = {
    bootstrapSession: vi.fn().mockResolvedValue({ status: 'authenticated' }),
    login: vi.fn().mockResolvedValue({ ok: true }),
    signup: vi.fn().mockResolvedValue({ ok: true }),
    logout: vi.fn().mockResolvedValue(undefined),
    recoverSession: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  };
  render(
    <MemoryRouter>
      <AuthProvider authPort={port}>
        <EventCreateActivationProvider>
          <ProductionStateProviders>
            <Probe />
          </ProductionStateProviders>
        </EventCreateActivationProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
  return port;
}
async function seedA() {
  await waitFor(() => expect(customers.customers).toEqual([customerA]));
  await act(async () => {
    await events.loadSchedule(range);
    await events.loadCustomerDetail(customerA.id, new Date(range.from));
    await events.createEvent({ ...eventA });
    customerDraft.setDraft('create', {
      displayName: 'Synthetic draft A',
      customerMemo: 'Synthetic memo A',
    });
    eventDraft.updateDraft({ customerId: customerA.id, note: 'Synthetic note A' });
    activation.recordCreateActivation({ kind: 'programmatic' });
    activation.armCreateReturn({
      kind: 'customer-detail',
      customerId: customerA.id,
      eventId: eventA.id,
    });
  });
}
function expectEmpty() {
  expect(customers.customers).toEqual([]);
  expect(events.events).toEqual([]);
  expect(events.highlightedEventId).toBeNull();
  expect(events.getCustomerSnapshot(customerA.id)).toBeUndefined();
  expect(customerDraft.getDraft('create')).toBeUndefined();
  expect(eventDraft.draft.customerId).toBeNull();
  expect(eventDraft.draft.note).toBe('');
  expect(activation.getPendingCreateReturn()).toBeNull();
  expect(document.body.textContent).not.toContain('Synthetic A');
}
beforeEach(() => {
  Object.values(customerPort).forEach((mock) => mock.mockReset());
  Object.values(eventPort).forEach((mock) => mock.mockReset());
  customerPort.list.mockResolvedValue([customerA]);
  customerPort.get.mockResolvedValue(customerA);
  customerPort.create.mockResolvedValue(customerA);
  customerPort.edit.mockResolvedValue(customerA);
  eventPort.list.mockResolvedValue([eventA]);
  eventPort.get.mockResolvedValue(eventA);
  eventPort.create.mockResolvedValue(eventA);
  mocks.compose.mockReset().mockReturnValue({ customerPort, customerEventPort: eventPort });
});

it('purges customers, events, snapshots, highlights and drafts before a pending logout settles', async () => {
  const logout = deferred<void>();
  renderSession({ logout: () => logout.promise });
  await seedA();
  await act(async () => {
    void auth.logout();
  });
  expect(auth.authState.status).toBe('ANONYMOUS');
  expectEmpty();
  customerPort.list.mockResolvedValue([]);
  await act(async () => {
    await auth.login({ account: 'synthetic-b', secret: 'test' });
  });
  expectEmpty();
  await act(async () => {
    logout.resolve();
    await logout.promise;
  });
  expect(auth.authState.status).toBe('AUTHENTICATED');
  expectEmpty();
});

it('isolates a batched logout/login even when no anonymous render occurs', async () => {
  renderSession();
  await seedA();
  customerPort.list.mockResolvedValue([]);
  await act(async () => {
    void auth.logout();
    await auth.login({ account: 'synthetic-b', secret: 'test' });
  });
  expect(auth.authState.status).toBe('AUTHENTICATED');
  expectEmpty();
});

it('clears A at the start of direct account switching and keeps B empty while its list is pending', async () => {
  const login = deferred<AuthCommandResult>();
  renderSession({ login: () => login.promise });
  await seedA();
  await act(async () => {
    void auth.login({ account: 'synthetic-b', secret: 'test' });
  });
  expectEmpty();
  const listB = deferred<readonly CustomerRecord[]>();
  customerPort.list.mockReturnValue(listB.promise);
  await act(async () => {
    login.resolve({ ok: true });
    await login.promise;
  });
  expectEmpty();
  await act(async () => {
    listB.resolve([customerB]);
    await listB.promise;
  });
  expect(customers.customers).toEqual([customerB]);
  expect(events.events).toEqual([]);
});

it.each(['resolve', 'reject'] as const)(
  'discards pending A reads and mutations that %s after B logs in',
  async (outcome) => {
    renderSession();
    await seedA();
    const list = deferred<readonly CustomerRecord[]>();
    const detail = deferred<CustomerRecord>();
    const mutation = deferred<CustomerRecord>();
    const eventRead = deferred<readonly CustomerEvent[]>();
    const eventMutation = deferred<CustomerEvent>();
    const eventDetail = deferred<CustomerEvent>();
    customerPort.list.mockReturnValueOnce(list.promise);
    customerPort.get.mockReturnValueOnce(detail.promise);
    customerPort.create.mockReturnValueOnce(mutation.promise);
    customerPort.edit.mockReturnValueOnce(mutation.promise);
    eventPort.list.mockReturnValue(eventRead.promise);
    eventPort.create.mockReturnValueOnce(eventMutation.promise);
    eventPort.edit.mockReturnValueOnce(eventMutation.promise);
    eventPort.cancel.mockReturnValueOnce(eventMutation.promise);
    eventPort.occur.mockReturnValueOnce(eventMutation.promise);
    eventPort.get.mockReturnValueOnce(eventDetail.promise);
    let pending: Promise<unknown>[] = [];
    const oldAuth = auth;
    await act(async () => {
      pending = [
        customers.refresh(),
        customers.loadCustomer(customerA.id),
        customers.createCustomer({ displayName: 'Synthetic A' }),
        customers.editCustomer(customerA.id, {
          displayName: 'Synthetic A',
          customerMemo: 'Synthetic memo A',
        }),
        events.loadSchedule(range),
        events.loadCustomerDetail(customerA.id, new Date(range.from)),
        events.createEvent({ ...eventA }),
        events.loadEvent(eventA.id),
        events.editEvent(eventA.id, { note: 'Synthetic note A' }),
        events.cancelEvent(eventA.id),
        events.occurEvent(eventA.id),
      ].map((p) => p.catch(() => undefined));
    });
    customerPort.list.mockResolvedValue([]);
    await act(async () => {
      await auth.login({ account: 'synthetic-b', secret: 'test' });
    });
    await act(async () => {
      if (outcome === 'resolve') {
        list.resolve([customerA]);
        detail.resolve(customerA);
        mutation.resolve(customerA);
        eventRead.resolve([eventA]);
        eventMutation.resolve(eventA);
        eventDetail.resolve(eventA);
      } else {
        for (const request of [list, detail, mutation, eventRead, eventMutation, eventDetail])
          request.reject(new CarelogHttpError(401));
      }
      await Promise.all(pending);
      oldAuth.reportFailure({ kind: AUTH_ERROR_KIND.UNAUTHORIZED });
    });
    expect(auth.authState.status).toBe('AUTHENTICATED');
    expect(auth.operationError).toBeNull();
    expectEmpty();
  },
);

it('keeps same-session caches through successful auth recovery and clears them on failed recovery', async () => {
  const recovery = deferred<AuthCommandResult>();
  renderSession({
    recoverSession: vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockImplementationOnce(() => recovery.promise),
  });
  await seedA();
  const storeA = customers;
  await act(async () => {
    auth.reportFailure({ kind: AUTH_ERROR_KIND.UNAUTHORIZED });
  });
  expect(customers.customers).toEqual([customerA]);
  expect(customers.getCustomer).toBe(storeA.getCustomer);
  expect(eventDraft.draft.note).toBe('Synthetic note A');
  await act(async () => {
    auth.reportFailure({ kind: AUTH_ERROR_KIND.UNAUTHORIZED });
  });
  await act(async () => {
    recovery.resolve({ ok: false, failure: { kind: AUTH_ERROR_KIND.UNAUTHORIZED } });
    await recovery.promise;
  });
  expect(auth.authState.status).toBe('ANONYMOUS');
  expectEmpty();
});

it('invalidates bootstrap retry results when login or logout changes the session', async () => {
  const retry = deferred<AuthBootstrapResult>();
  const bootstrapSession = vi
    .fn()
    .mockResolvedValueOnce({ status: 'authenticated' })
    .mockImplementationOnce(() => retry.promise);
  renderSession({ bootstrapSession });
  await seedA();
  await act(async () => {
    auth.retryBootstrap();
  });
  expectEmpty();
  customerPort.list.mockResolvedValue([]);
  await act(async () => {
    await auth.login({ account: 'synthetic-b', secret: 'test' });
  });
  await act(async () => {
    retry.resolve({ status: 'anonymous' });
    await retry.promise;
  });
  expect(auth.authState.status).toBe('AUTHENTICATED');
  expectEmpty();
});

it('ignores a recovery from A that finishes after login B', async () => {
  const recovery = deferred<AuthCommandResult>();
  renderSession({ recoverSession: () => recovery.promise });
  await seedA();
  await act(async () => {
    auth.reportFailure({ kind: AUTH_ERROR_KIND.UNAUTHORIZED });
  });
  customerPort.list.mockResolvedValue([]);
  await act(async () => {
    await auth.login({ account: 'synthetic-b', secret: 'test' });
  });
  await act(async () => {
    recovery.resolve({ ok: false, failure: { kind: AUTH_ERROR_KIND.UNAUTHORIZED } });
    await recovery.promise;
  });
  expect(auth.authState.status).toBe('AUTHENTICATED');
  expectEmpty();
});

it('ignores retry operation failures from A after B logs in', async () => {
  const retry = deferred<void>();
  renderSession();
  await seedA();
  await act(async () => {
    auth.reportFailure({ kind: AUTH_ERROR_KIND.NETWORK }, () => retry.promise);
  });
  let operation!: Promise<void>;
  await act(async () => {
    operation = auth.retryOperation();
  });
  customerPort.list.mockResolvedValue([]);
  await act(async () => {
    await auth.login({ account: 'synthetic-b', secret: 'test' });
  });
  await act(async () => {
    retry.reject({ kind: AUTH_ERROR_KIND.UNAUTHORIZED });
    await operation;
  });
  expect(auth.authState.status).toBe('AUTHENTICATED');
  expect(auth.operationError).toBeNull();
  expectEmpty();
});

it('does not authenticate a pending login after logout', async () => {
  const login = deferred<AuthCommandResult>();
  renderSession({ login: () => login.promise });
  await seedA();
  await act(async () => {
    void auth.login({ account: 'synthetic-b', secret: 'test' });
  });
  await act(async () => {
    await auth.logout();
  });
  await act(async () => {
    login.resolve({ ok: true });
    await login.promise;
  });
  expect(auth.authState.status).toBe('ANONYMOUS');
  expectEmpty();
});

it('does not let delayed bootstrap authenticate after logout', async () => {
  const bootstrap = deferred<AuthBootstrapResult>();
  renderSession({ bootstrapSession: () => bootstrap.promise });
  await act(async () => {
    await auth.logout();
  });
  await act(async () => {
    bootstrap.resolve({ status: 'authenticated' });
    await bootstrap.promise;
  });
  expect(auth.authState.status).toBe('ANONYMOUS');
  expectEmpty();
  expect(customerPort.list).not.toHaveBeenCalled();
});

it('preserves the production login form and its error when credentials are rejected', async () => {
  render(
    <MemoryRouter initialEntries={['/auth/login']}>
      <AppRouter
        authPort={createInMemoryAuthPort({ bootstrap: 'anonymous', login: 'invalid-credentials' })}
      />
    </MemoryRouter>,
  );
  const account = await screen.findByLabelText('계정');
  const secret = screen.getByLabelText('비밀번호');
  fireEvent.change(account, { target: { value: 'synthetic-invalid' } });
  fireEvent.change(secret, { target: { value: 'synthetic-test' } });
  fireEvent.click(screen.getByRole('button', { name: '로그인' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('계정 정보를 확인할 수 없습니다');
  expect(account).toHaveValue('synthetic-invalid');
  expect(secret).toHaveValue('synthetic-test');
  expect(customerPort.list).not.toHaveBeenCalled();
});

it('preserves create-return targets across route changes within the same session', async () => {
  renderSession();
  await seedA();
  const provenance = activation.getPendingCreateReturn();
  expect(provenance?.target.customerId).toBe(customerA.id);
  await act(async () => {
    await navigate('/app/customers/synthetic-a');
  });
  expect(activation.getPendingCreateReturn()).toEqual(provenance);
  expect(customers.customers).toEqual([customerA]);
});
