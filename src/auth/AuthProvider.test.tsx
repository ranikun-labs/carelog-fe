import { render, screen, waitFor } from '@testing-library/react';
import { act, useState } from 'react';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import {
  AUTH_ERROR_KIND,
  AUTH_STATE,
  type AuthBootstrapResult,
  type AuthCommandResult,
  type AuthErrorKind,
  type AuthPort,
} from '@/auth/authTypes';
import { createInMemoryAuthPort } from '@/auth/inMemoryAuthAdapter';
import { createUnavailableAuthPort } from '@/auth/unavailableAuthPort';
import { CUSTOMER_FIXTURE_RECORDS } from '@/fixtures/scenarios';
import { SCHEDULE_FIXTURE } from '@/fixtures/schedule';
import { CustomerStoreProvider, useOptionalCustomerStore } from '@/state/CustomerStoreContext';
import { EventStoreProvider, useOptionalEventStore } from '@/state/EventStoreContext';

function Probe() {
  const auth = useAuth();
  const customerStore = useOptionalCustomerStore();
  const eventStore = useOptionalEventStore();
  const [mountId] = useState(() => Math.random().toString(36));
  return (
    <div>
      <output data-auth-state>{auth.authState.status}</output>
      <output data-operation-error>{auth.operationError?.failure.kind ?? ''}</output>
      {customerStore && eventStore ? (
        <>
          <output data-customer-count>{customerStore.customers.length}</output>
          <output data-event-count>{eventStore.events.length}</output>
          <output data-provider-mounts>{mountId}</output>
        </>
      ) : null}
      <button
        type="button"
        onClick={() => auth.reportFailure({ kind: AUTH_ERROR_KIND.UNAUTHORIZED })}
      >
        401
      </button>
      <button type="button" onClick={() => auth.reportFailure({ kind: AUTH_ERROR_KIND.FORBIDDEN })}>
        403
      </button>
      <button type="button" onClick={() => auth.reportFailure({ kind: AUTH_ERROR_KIND.SERVER })}>
        5xx
      </button>
      <button type="button" onClick={() => auth.reportFailure({ kind: AUTH_ERROR_KIND.NETWORK })}>
        network
      </button>
      <button type="button" onClick={() => void auth.logout()}>
        logout
      </button>
      <button type="button" onClick={() => void auth.retryOperation()}>
        retry
      </button>
      <button type="button" onClick={auth.retryBootstrap}>
        retry bootstrap
      </button>
    </div>
  );
}

function renderProbe(port: AuthPort) {
  return render(
    <AuthProvider authPort={port}>
      <Probe />
    </AuthProvider>,
  );
}

async function expectState(status: string) {
  await waitFor(() =>
    expect(document.querySelector('[data-auth-state]')).toHaveTextContent(status),
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

function createControlledBootstrapPort() {
  const bootstraps: Array<ReturnType<typeof deferred<AuthBootstrapResult>>> = [];
  const port: AuthPort = {
    bootstrapSession: () => {
      const request = deferred<AuthBootstrapResult>();
      bootstraps.push(request);
      return request.promise;
    },
    login: async (): Promise<AuthCommandResult> => ({ ok: true }),
    signup: async (): Promise<AuthCommandResult> => ({ ok: true }),
    logout: async () => undefined,
    recoverSession: async (): Promise<AuthCommandResult> => ({ ok: true }),
  };
  return { port, bootstraps };
}

function createControlledRecoveryPort() {
  const recoveries: Array<ReturnType<typeof deferred<AuthCommandResult>>> = [];
  const port: AuthPort = {
    bootstrapSession: async () => ({ status: 'authenticated' }),
    login: async (): Promise<AuthCommandResult> => ({ ok: true }),
    signup: async (): Promise<AuthCommandResult> => ({ ok: true }),
    logout: async () => undefined,
    recoverSession: () => {
      const recovery = deferred<AuthCommandResult>();
      recoveries.push(recovery);
      return recovery.promise;
    },
  };
  return { port, recoveries };
}

it('bootstraps an anonymous session without exposing a product boolean shortcut', async () => {
  const port = createInMemoryAuthPort({ bootstrap: 'anonymous' });
  renderProbe(port);
  expect(document.querySelector('[data-auth-state]')).toHaveTextContent(AUTH_STATE.BOOTSTRAPPING);
  await expectState(AUTH_STATE.ANONYMOUS);
  expect(port.bootstrapAttemptCount).toBe(1);
});

it('allows one recovery attempt per independent 401 episode', async () => {
  const { port, recoveries } = createControlledRecoveryPort();
  renderProbe(port);
  await expectState(AUTH_STATE.AUTHENTICATED);

  await act(async () => {
    screen.getByRole('button', { name: '401' }).click();
    screen.getByRole('button', { name: '401' }).click();
  });
  await expectState(AUTH_STATE.RECOVERING);
  expect(recoveries).toHaveLength(1);

  await act(async () => {
    recoveries[0]!.resolve({ ok: true });
    await recoveries[0]!.promise;
  });
  await expectState(AUTH_STATE.AUTHENTICATED);

  await act(async () => {
    screen.getByRole('button', { name: '401' }).click();
  });
  await expectState(AUTH_STATE.RECOVERING);
  expect(recoveries).toHaveLength(2);

  await act(async () => {
    recoveries[1]!.resolve({ ok: true });
    await recoveries[1]!.promise;
  });
  await expectState(AUTH_STATE.AUTHENTICATED);
  expect(recoveries).toHaveLength(2);
});

it('coalesces concurrent 401 signals into one recovery promise', async () => {
  const port = createInMemoryAuthPort({
    bootstrap: 'authenticated',
    recovery: 'success',
    recoveryDelayMs: 20,
  });
  renderProbe(port);
  await expectState(AUTH_STATE.AUTHENTICATED);

  await act(async () => {
    screen.getByRole('button', { name: '401' }).click();
    screen.getByRole('button', { name: '401' }).click();
    await new Promise((resolve) => setTimeout(resolve, 30));
  });

  expect(document.querySelector('[data-auth-state]')).toHaveTextContent(AUTH_STATE.AUTHENTICATED);
  expect(port.recoveryAttemptCount).toBe(1);
});

it('returns to anonymous after one failed recovery', async () => {
  const port = createInMemoryAuthPort({ bootstrap: 'authenticated', recovery: 'server' });
  renderProbe(port);
  await expectState(AUTH_STATE.AUTHENTICATED);
  await act(async () => {
    screen.getByRole('button', { name: '401' }).click();
    await Promise.resolve();
  });
  await expectState(AUTH_STATE.ANONYMOUS);
  expect(port.recoveryAttemptCount).toBe(1);
});

it.each([
  [AUTH_ERROR_KIND.FORBIDDEN, '403'],
  [AUTH_ERROR_KIND.SERVER, '5xx'],
  [AUTH_ERROR_KIND.NETWORK, 'network'],
] as const)(
  '%s preserves authenticated state and exposes an operation error',
  async (kind: AuthErrorKind, action: string) => {
    const port = createInMemoryAuthPort({ bootstrap: 'authenticated' });
    renderProbe(port);
    await expectState(AUTH_STATE.AUTHENTICATED);
    screen.getByRole('button', { name: action }).click();
    await waitFor(() =>
      expect(document.querySelector('[data-operation-error]')).toHaveTextContent(kind),
    );
    expect(document.querySelector('[data-auth-state]')).toHaveTextContent(AUTH_STATE.AUTHENTICATED);
  },
);

it('clears the session on logout while leaving auth ownership separate from product state', async () => {
  const port = createInMemoryAuthPort({ bootstrap: 'authenticated' });
  renderProbe(port);
  await expectState(AUTH_STATE.AUTHENTICATED);
  screen.getByRole('button', { name: 'logout' }).click();
  await expectState(AUTH_STATE.ANONYMOUS);
});

it('invokes logout once when the action is submitted repeatedly while pending', async () => {
  const port = createInMemoryAuthPort({ bootstrap: 'authenticated', logoutDelayMs: 20 });
  renderProbe(port);
  await expectState(AUTH_STATE.AUTHENTICATED);

  screen.getByRole('button', { name: 'logout' }).click();
  screen.getByRole('button', { name: 'logout' }).click();
  await expectState(AUTH_STATE.ANONYMOUS);
  expect(port.logoutAttemptCount).toBe(1);
});

it('ignores a stale bootstrap result after a newer retry wins', async () => {
  const { port, bootstraps } = createControlledBootstrapPort();
  renderProbe(port);
  await waitFor(() => expect(bootstraps).toHaveLength(1));

  screen.getByRole('button', { name: 'retry bootstrap' }).click();
  await waitFor(() => expect(bootstraps).toHaveLength(2));

  await act(async () => {
    bootstraps[1].resolve({ status: 'anonymous' });
    await Promise.resolve();
  });
  await expectState(AUTH_STATE.ANONYMOUS);

  await act(async () => {
    bootstraps[0].resolve({ status: 'authenticated' });
    await Promise.resolve();
  });
  expect(document.querySelector('[data-auth-state]')).toHaveTextContent(AUTH_STATE.ANONYMOUS);
});

it('ignores a late bootstrap result after the provider unmounts', async () => {
  const { port, bootstraps } = createControlledBootstrapPort();
  const { unmount } = renderProbe(port);
  await waitFor(() => expect(bootstraps).toHaveLength(1));
  unmount();

  await act(async () => {
    bootstraps[0].resolve({ status: 'authenticated' });
    await Promise.resolve();
  });
  expect(document.querySelector('[data-auth-state]')).not.toBeInTheDocument();
});

it('uses an unavailable production boundary that cannot authenticate arbitrary credentials', async () => {
  const port = createUnavailableAuthPort();
  expect(await port.bootstrapSession()).toEqual({ status: 'anonymous' });
  expect(await port.login({ account: 'anything@example.com', secret: 'anything' })).toEqual({
    ok: false,
    failure: { kind: AUTH_ERROR_KIND.UNKNOWN },
  });
  expect(await port.signup({ account: 'anything@example.com', secret: 'anything' })).toEqual({
    ok: false,
    failure: { kind: AUTH_ERROR_KIND.UNKNOWN },
  });
});

it('preserves Customer and Event providers through authenticated failures and recovery', async () => {
  const { port, recoveries } = createControlledRecoveryPort();
  render(
    <AuthProvider authPort={port}>
      <CustomerStoreProvider initialCustomers={CUSTOMER_FIXTURE_RECORDS}>
        <EventStoreProvider initialEvents={SCHEDULE_FIXTURE.events}>
          <Probe />
        </EventStoreProvider>
      </CustomerStoreProvider>
    </AuthProvider>,
  );

  await expectState(AUTH_STATE.AUTHENTICATED);
  expect(document.querySelector('[data-customer-count]')).toHaveTextContent(
    String(CUSTOMER_FIXTURE_RECORDS.length),
  );
  expect(document.querySelector('[data-event-count]')).toHaveTextContent(
    String(SCHEDULE_FIXTURE.events.length),
  );
  const providerMountId = document.querySelector('[data-provider-mounts]')?.textContent;
  expect(providerMountId).toBeTruthy();

  for (const action of ['403', '5xx', 'network']) {
    screen.getByRole('button', { name: action }).click();
    await waitFor(() =>
      expect(document.querySelector('[data-operation-error]')).not.toHaveTextContent(''),
    );
    expect(document.querySelector('[data-auth-state]')).toHaveTextContent(AUTH_STATE.AUTHENTICATED);
    expect(document.querySelector('[data-customer-count]')).toHaveTextContent(
      String(CUSTOMER_FIXTURE_RECORDS.length),
    );
    expect(document.querySelector('[data-event-count]')).toHaveTextContent(
      String(SCHEDULE_FIXTURE.events.length),
    );
    expect(document.querySelector('[data-provider-mounts]')).toHaveTextContent(providerMountId!);
  }

  await act(async () => {
    screen.getByRole('button', { name: '401' }).click();
  });
  await expectState(AUTH_STATE.RECOVERING);
  expect(recoveries).toHaveLength(1);
  expect(document.querySelector('[data-customer-count]')).toHaveTextContent(
    String(CUSTOMER_FIXTURE_RECORDS.length),
  );
  expect(document.querySelector('[data-event-count]')).toHaveTextContent(
    String(SCHEDULE_FIXTURE.events.length),
  );
  expect(document.querySelector('[data-provider-mounts]')).toHaveTextContent(providerMountId!);

  await act(async () => {
    recoveries[0]!.resolve({ ok: true });
    await recoveries[0]!.promise;
  });
  await expectState(AUTH_STATE.AUTHENTICATED);
  expect(document.querySelector('[data-customer-count]')).toHaveTextContent(
    String(CUSTOMER_FIXTURE_RECORDS.length),
  );
  expect(document.querySelector('[data-event-count]')).toHaveTextContent(
    String(SCHEDULE_FIXTURE.events.length),
  );
  expect(document.querySelector('[data-provider-mounts]')).toHaveTextContent(providerMountId!);
});
