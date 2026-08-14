import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { CarelogHttpError } from '@/integrations/carelog/errors';
import { CustomerStoreProvider, useCustomerStore } from '@/state/CustomerStoreContext';

function Probe() {
  const store = useCustomerStore();
  return (
    <div>
      <button type="button" onClick={() => void store.refresh().catch(() => undefined)}>
        refresh
      </button>
      <button
        type="button"
        onClick={() =>
          void store.createCustomer({ displayName: '서버 고객' }).catch(() => undefined)
        }
      >
        create
      </button>
      <p data-testid="customer-name">{store.customers[0]?.displayName}</p>
      <p data-testid="customer-state">{store.loadState}</p>
      <p data-testid="customer-error">{store.errorCode}</p>
    </div>
  );
}

describe('CustomerStore production async boundary', () => {
  it('reconciles list/create from the port and never invents a local identity', async () => {
    const port = {
      list: vi.fn().mockResolvedValue([{ id: 'server-id', displayName: '서버 목록' }]),
      get: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: 'server-created-id', displayName: '서버 고객' }),
      edit: vi.fn(),
    };
    render(
      <CustomerStoreProvider port={port}>
        <Probe />
      </CustomerStoreProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'refresh' }));
    await waitFor(() => expect(screen.getByTestId('customer-name')).toHaveTextContent('서버 목록'));
    fireEvent.click(screen.getByRole('button', { name: 'create' }));
    await waitFor(() => expect(screen.getByTestId('customer-name')).toHaveTextContent('서버 목록'));
    expect(port.create).toHaveBeenCalledWith({ displayName: '서버 고객' });
  });

  it('preserves the existing product state on a server mutation failure', async () => {
    const port = {
      list: vi.fn().mockResolvedValue([{ id: 'server-id', displayName: '기존 고객' }]),
      get: vi.fn(),
      create: vi.fn().mockRejectedValue(new CarelogHttpError(409)),
      edit: vi.fn(),
    };
    render(
      <CustomerStoreProvider
        port={port}
        initialCustomers={[{ id: 'server-id', displayName: '기존 고객' }]}
      >
        <Probe />
      </CustomerStoreProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'create' }));
    await waitFor(() => expect(screen.getByTestId('customer-error')).toHaveTextContent('CONFLICT'));
    expect(screen.getByTestId('customer-name')).toHaveTextContent('기존 고객');
  });
});
