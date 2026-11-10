import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '@/i18n/I18nContext';
import type { CustomerPort } from '@/integrations/carelog/customerPort';
import { CustomersPage } from '@/pages/CustomersPage';
import {
  CustomerStoreProvider,
  type CustomerStoreValue,
  useCustomerStore,
} from '@/state/CustomerStoreContext';
import type { CustomerRecord } from '@/types/customer';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const confirmed: CustomerRecord = { id: 'server-confirmed-customer', displayName: '저장된 고객' };
const obsolete: CustomerRecord = { id: 'obsolete-customer', displayName: '이전 고객' };

function port(overrides: Partial<CustomerPort>): CustomerPort {
  return { list: vi.fn(), get: vi.fn(), create: vi.fn(), edit: vi.fn(), ...overrides };
}

function mount(customerPort: CustomerPort, assertSessionOwner?: () => void) {
  let store!: CustomerStoreValue;
  function Probe() {
    store = useCustomerStore();
    return null;
  }
  render(
    <MemoryRouter>
      <I18nProvider locale="ko">
        <CustomerStoreProvider
          initialCustomers={[]}
          port={customerPort}
          assertSessionOwner={assertSessionOwner}
        >
          <Probe />
          <CustomersPage />
        </CustomerStoreProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
  return () => store;
}

describe('customer list completion after a confirmed save', () => {
  it.each(['resolve', 'reject'] as const)(
    'shows the saved customer when an obsolete refresh later %ss',
    async (outcome) => {
      const oldRead = deferred<readonly CustomerRecord[]>();
      const current = mount(
        port({
          list: vi.fn().mockReturnValue(oldRead.promise),
          create: vi.fn().mockResolvedValue(confirmed),
        }),
      );
      let read!: Promise<void>;
      await act(async () => {
        read = current().refresh();
      });
      await act(async () => {
        await current().createCustomer({ displayName: confirmed.displayName });
      });
      await act(async () => {
        if (outcome === 'resolve') oldRead.resolve([obsolete]);
        else oldRead.reject(new Error('obsolete read failure'));
        await read;
      });
      expect(current().customers).toEqual([confirmed]);
      expect(current().error).toBeNull();
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: confirmed.displayName })).toBeVisible();
      expect(current().loadState).toBe('ready');
    },
  );
  it('keeps a newer customer refresh loading until that refresh finishes', async () => {
    const oldRead = deferred<readonly CustomerRecord[]>();
    const newRead = deferred<readonly CustomerRecord[]>();
    const current = mount(
      port({
        list: vi.fn().mockReturnValueOnce(oldRead.promise).mockReturnValueOnce(newRead.promise),
        create: vi.fn().mockResolvedValue(confirmed),
      }),
    );
    let oldResult!: Promise<void>;
    let newResult!: Promise<void>;
    await act(async () => {
      oldResult = current().refresh();
    });
    await act(async () => {
      await current().createCustomer({ displayName: confirmed.displayName });
    });
    await act(async () => {
      newResult = current().refresh();
    });
    await act(async () => {
      oldRead.resolve([obsolete]);
      await oldResult;
    });
    expect(current().customers).toEqual([confirmed]);
    expect(current().loadState).toBe('loading');
    expect(screen.getByRole('status')).toBeVisible();
    await act(async () => {
      newRead.resolve([confirmed, obsolete]);
      await newResult;
    });
    expect(current().loadState).toBe('ready');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: confirmed.displayName })).toBeVisible();
  });

  it('does not settle an obsolete customer read after its session owner has left', async () => {
    const oldRead = deferred<readonly CustomerRecord[]>();
    let ownerCurrent = true;
    const assertOwner = () => {
      if (!ownerCurrent) throw new DOMException('session changed', 'AbortError');
    };
    const current = mount(
      port({
        list: vi.fn().mockReturnValue(oldRead.promise),
        create: vi.fn().mockResolvedValue(confirmed),
      }),
      assertOwner,
    );
    let read!: Promise<void>;
    await act(async () => {
      read = current().refresh();
    });
    await act(async () => {
      await current().createCustomer({ displayName: confirmed.displayName });
    });
    const before = current();
    ownerCurrent = false;
    await act(async () => {
      oldRead.resolve([obsolete]);
      await read;
    });
    expect(current()).toBe(before);
    expect(current().loadState).toBe('loading');
    expect(current().customers).toEqual([confirmed]);
  });

  it('keeps the error of a current refresh when no save invalidated it', async () => {
    const failure = new Error('current refresh failed');
    const current = mount(port({ list: vi.fn().mockRejectedValue(failure) }));
    await act(async () => {
      await expect(current().refresh()).rejects.toThrow('current refresh failed');
    });
    expect(current().loadState).toBe('error');
    expect(current().error).toBe(failure);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
