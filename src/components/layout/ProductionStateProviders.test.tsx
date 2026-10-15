import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';

import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { createInMemoryAuthPort } from '@/auth/inMemoryAuthAdapter';

const mocks = vi.hoisted(() => ({
  createProductionProductPorts: vi.fn(),
  listCustomers: vi.fn(),
  listEvents: vi.fn(),
}));

vi.mock('@/integrations/carelog/productionComposition', () => ({
  createProductionProductPorts: mocks.createProductionProductPorts,
}));

import { ProductionStateProviders } from '@/components/layout/ProductionStateProviders';

function Probe() {
  const auth = useAuth();
  return (
    <>
      <output data-auth-state>{auth.authState.status}</output>
      <button
        type="button"
        onClick={() => void auth.login({ account: 'therapist', secret: 'secret' })}
      >
        login
      </button>
      <button type="button" onClick={() => void auth.logout()}>
        logout
      </button>
    </>
  );
}

beforeEach(() => {
  mocks.listCustomers.mockReset().mockResolvedValue([]);
  mocks.listEvents.mockReset().mockResolvedValue([]);
  mocks.createProductionProductPorts.mockReset().mockReturnValue({
    customerPort: {
      list: mocks.listCustomers,
      get: vi.fn(),
      create: vi.fn(),
      edit: vi.fn(),
    },
    customerEventPort: {
      list: mocks.listEvents,
      get: vi.fn(),
      create: vi.fn(),
      edit: vi.fn(),
      occur: vi.fn(),
      cancel: vi.fn(),
    },
  });
});

it('does not read product data until the AuthProvider reaches AUTHENTICATED', async () => {
  render(
    <MemoryRouter>
      <AuthProvider authPort={createInMemoryAuthPort({ bootstrap: 'anonymous' })}>
        <ProductionStateProviders>
          <Probe />
        </ProductionStateProviders>
      </AuthProvider>
    </MemoryRouter>,
  );

  await waitFor(() => expect(screen.getByText('ANONYMOUS')).toBeInTheDocument());
  expect(mocks.listCustomers).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'login' }));
  await waitFor(() => expect(screen.getByText('AUTHENTICATED')).toBeInTheDocument());
  await waitFor(() => expect(mocks.listCustomers).toHaveBeenCalledTimes(1));

  fireEvent.click(screen.getByRole('button', { name: 'logout' }));
  await waitFor(() => expect(screen.getByText('ANONYMOUS')).toBeInTheDocument());
  expect(mocks.listCustomers).toHaveBeenCalledTimes(1);
});
