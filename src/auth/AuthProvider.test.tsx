import { render, screen, waitFor } from '@testing-library/react';
import { act, useState } from 'react';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { AUTH_ERROR_KIND, AUTH_STATE, type AuthErrorKind } from '@/auth/authTypes';
import { createInMemoryAuthPort } from '@/auth/inMemoryAuthAdapter';
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
    </div>
  );
}

function renderProbe(port: ReturnType<typeof createInMemoryAuthPort>) {
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

it('bootstraps an anonymous session without exposing a product boolean shortcut', async () => {
  const port = createInMemoryAuthPort({ bootstrap: 'anonymous' });
  renderProbe(port);
  expect(document.querySelector('[data-auth-state]')).toHaveTextContent(AUTH_STATE.BOOTSTRAPPING);
  await expectState(AUTH_STATE.ANONYMOUS);
  expect(port.bootstrapAttemptCount).toBe(1);
});

it('recovers a 401 exactly once and returns to authenticated state on success', async () => {
  const port = createInMemoryAuthPort({ bootstrap: 'authenticated', recovery: 'success' });
  renderProbe(port);
  await expectState(AUTH_STATE.AUTHENTICATED);

  await act(async () => {
    screen.getByRole('button', { name: '401' }).click();
    await Promise.resolve();
  });
  expect(document.querySelector('[data-auth-state]')).toHaveTextContent(AUTH_STATE.AUTHENTICATED);
  expect(port.recoveryAttemptCount).toBe(1);

  await act(async () => {
    screen.getByRole('button', { name: '401' }).click();
    await Promise.resolve();
  });
  await expectState(AUTH_STATE.ANONYMOUS);
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

it('preserves Customer and Event providers through authenticated failures and recovery', async () => {
  const port = createInMemoryAuthPort({ bootstrap: 'authenticated', recovery: 'success' });
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
    await Promise.resolve();
  });
  expect(port.recoveryAttemptCount).toBe(1);
  expect(document.querySelector('[data-auth-state]')).toHaveTextContent(AUTH_STATE.AUTHENTICATED);
  expect(document.querySelector('[data-provider-mounts]')).toHaveTextContent(providerMountId!);
});
