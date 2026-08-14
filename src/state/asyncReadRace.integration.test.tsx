import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CustomerEvent } from '@/domain/customerEvent';
import type { CustomerEventPort } from '@/integrations/carelog/customerEventPort';
import type { CustomerPort } from '@/integrations/carelog/customerPort';
import {
  CustomerStoreProvider,
  type CustomerStoreValue,
  useCustomerStore,
} from '@/state/CustomerStoreContext';
import { EventStoreProvider, type EventStoreValue, useEventStore } from '@/state/EventStoreContext';
import type { CustomerRecord } from '@/types/customer';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function CustomerProbe({ onStore }: { onStore: (store: CustomerStoreValue) => void }) {
  onStore(useCustomerStore());
  return null;
}

function EventProbe({ onStore }: { onStore: (store: EventStoreValue) => void }) {
  onStore(useEventStore());
  return null;
}

const rangeA = {
  from: '2026-08-17T00:00:00+09:00',
  to: '2026-08-24T00:00:00+09:00',
};

const rangeB = {
  from: '2026-08-24T00:00:00+09:00',
  to: '2026-08-31T00:00:00+09:00',
};

const eventA: CustomerEvent = {
  id: 'event-range-a',
  customerId: 'customer-1',
  status: 'PLANNED',
  scheduledAt: '2026-08-18T10:00:00+09:00',
};

const eventB: CustomerEvent = {
  id: 'event-range-b',
  customerId: 'customer-1',
  status: 'PLANNED',
  scheduledAt: '2026-08-25T10:00:00+09:00',
};

const customerA: CustomerRecord = { id: 'customer-a', displayName: '고객 A' };
const customerB: CustomerRecord = { id: 'customer-b', displayName: '고객 B' };

function eventPort(overrides: Partial<CustomerEventPort>): CustomerEventPort {
  return {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    edit: vi.fn(),
    occur: vi.fn(),
    cancel: vi.fn(),
    ...overrides,
  };
}

function customerPort(overrides: Partial<CustomerPort>): CustomerPort {
  return {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    edit: vi.fn(),
    ...overrides,
  };
}

describe('async read race guards', () => {
  it('keeps the newest schedule range when an older request resolves last', async () => {
    const requestA = deferred<readonly CustomerEvent[]>();
    const requestB = deferred<readonly CustomerEvent[]>();
    const list = vi
      .fn()
      .mockImplementationOnce(() => requestA.promise)
      .mockImplementationOnce(() => requestB.promise);
    const port = eventPort({ list });
    let store: EventStoreValue | undefined;

    render(
      <EventStoreProvider initialEvents={[]} port={port}>
        <EventProbe onStore={(nextStore) => (store = nextStore)} />
      </EventStoreProvider>,
    );

    await act(async () => {
      void store!.loadSchedule(rangeA).catch(() => undefined);
      void store!.loadSchedule(rangeB).catch(() => undefined);
    });
    await act(async () => {
      requestB.resolve([eventB]);
      await requestB.promise;
    });
    await waitFor(() => expect(store!.events).toEqual([eventB]));

    await act(async () => {
      requestA.resolve([eventA]);
      await requestA.promise;
    });

    expect(store!.events).toEqual([eventB]);
    expect(store!.scheduleLoadState).toBe('ready');
  });

  it('ignores a stale schedule failure after the newest request succeeds', async () => {
    const requestA = deferred<readonly CustomerEvent[]>();
    const requestB = deferred<readonly CustomerEvent[]>();
    const list = vi
      .fn()
      .mockImplementationOnce(() => requestA.promise)
      .mockImplementationOnce(() => requestB.promise);
    const port = eventPort({ list });
    let store: EventStoreValue | undefined;

    render(
      <EventStoreProvider initialEvents={[]} port={port}>
        <EventProbe onStore={(nextStore) => (store = nextStore)} />
      </EventStoreProvider>,
    );

    await act(async () => {
      void store!.loadSchedule(rangeA).catch(() => undefined);
      void store!.loadSchedule(rangeB).catch(() => undefined);
      requestB.resolve([eventB]);
      await requestB.promise;
    });
    await waitFor(() => expect(store!.events).toEqual([eventB]));

    await act(async () => {
      requestA.reject(new Error('older range failed'));
      await expect(requestA.promise).rejects.toThrow('older range failed');
    });

    expect(store!.events).toEqual([eventB]);
    expect(store!.error).toBeNull();
    expect(store!.scheduleLoadState).toBe('ready');
  });

  it('does not let a pre-mutation schedule read replace a confirmed event', async () => {
    const oldRead = deferred<readonly CustomerEvent[]>();
    const createdEvent: CustomerEvent = {
      ...eventB,
      id: 'event-created-after-read',
    };
    const port = eventPort({
      list: vi.fn().mockResolvedValue(oldRead.promise),
      create: vi.fn().mockResolvedValue(createdEvent),
    });
    let store: EventStoreValue | undefined;

    render(
      <EventStoreProvider initialEvents={[]} port={port}>
        <EventProbe onStore={(nextStore) => (store = nextStore)} />
      </EventStoreProvider>,
    );

    let read: Promise<void> | undefined;
    await act(async () => {
      read = store!.loadSchedule(rangeA);
    });
    await act(async () => {
      await store!.createEvent({
        status: 'PLANNED',
        customerId: createdEvent.customerId,
        scheduledAt: createdEvent.scheduledAt,
      });
    });
    await waitFor(() => expect(store!.events).toEqual([createdEvent]));

    await act(async () => {
      oldRead.resolve([eventA]);
      await oldRead.promise;
      await read;
    });

    expect(store!.events).toEqual([createdEvent]);
  });

  it('keeps the newest customer list when an older refresh resolves last', async () => {
    const requestA = deferred<readonly CustomerRecord[]>();
    const requestB = deferred<readonly CustomerRecord[]>();
    const list = vi
      .fn()
      .mockImplementationOnce(() => requestA.promise)
      .mockImplementationOnce(() => requestB.promise);
    const port = customerPort({ list });
    let store: CustomerStoreValue | undefined;

    render(
      <CustomerStoreProvider initialCustomers={[]} port={port}>
        <CustomerProbe onStore={(nextStore) => (store = nextStore)} />
      </CustomerStoreProvider>,
    );

    await act(async () => {
      void store!.refresh().catch(() => undefined);
      void store!.refresh().catch(() => undefined);
    });
    await act(async () => {
      requestB.resolve([customerB]);
      await requestB.promise;
    });
    await waitFor(() => expect(store!.customers).toEqual([customerB]));

    await act(async () => {
      requestA.resolve([customerA]);
      await requestA.promise;
    });

    expect(store!.customers).toEqual([customerB]);
    expect(store!.loadState).toBe('ready');
  });

  it('does not let a pre-mutation customer refresh remove the confirmed customer', async () => {
    const oldRead = deferred<readonly CustomerRecord[]>();
    const createdCustomer: CustomerRecord = {
      id: 'customer-created-after-read',
      displayName: '생성 고객',
    };
    const port = customerPort({
      list: vi.fn().mockResolvedValue(oldRead.promise),
      create: vi.fn().mockResolvedValue(createdCustomer),
    });
    let store: CustomerStoreValue | undefined;

    render(
      <CustomerStoreProvider initialCustomers={[]} port={port}>
        <CustomerProbe onStore={(nextStore) => (store = nextStore)} />
      </CustomerStoreProvider>,
    );

    let read: Promise<void> | undefined;
    await act(async () => {
      read = store!.refresh();
    });
    await act(async () => {
      await store!.createCustomer({ displayName: createdCustomer.displayName });
    });
    await waitFor(() => expect(store!.customers).toEqual([createdCustomer]));

    await act(async () => {
      oldRead.resolve([customerA]);
      await oldRead.promise;
      await read;
    });

    expect(store!.customers).toEqual([createdCustomer]);
  });

  it('keeps the current customer when a stale refresh fails after a newer success', async () => {
    const requestA = deferred<readonly CustomerRecord[]>();
    const requestB = deferred<readonly CustomerRecord[]>();
    const list = vi
      .fn()
      .mockImplementationOnce(() => requestA.promise)
      .mockImplementationOnce(() => requestB.promise);
    const port = customerPort({ list });
    let store: CustomerStoreValue | undefined;

    render(
      <CustomerStoreProvider initialCustomers={[]} port={port}>
        <CustomerProbe onStore={(nextStore) => (store = nextStore)} />
      </CustomerStoreProvider>,
    );

    await act(async () => {
      void store!.refresh().catch(() => undefined);
      void store!.refresh().catch(() => undefined);
      requestB.resolve([customerB]);
      await requestB.promise;
    });
    await waitFor(() => expect(store!.customers).toEqual([customerB]));

    await act(async () => {
      requestA.reject(new Error('older customer refresh failed'));
      await expect(requestA.promise).rejects.toThrow('older customer refresh failed');
    });

    expect(store!.customers).toEqual([customerB]);
    expect(store!.error).toBeNull();
    expect(store!.loadState).toBe('ready');
  });

  it('does not let a stale customer scope load overwrite the current scope', async () => {
    const requestA = deferred<CustomerRecord>();
    const requestB = deferred<CustomerRecord>();
    const get = vi
      .fn()
      .mockImplementationOnce(() => requestA.promise)
      .mockImplementationOnce(() => requestB.promise);
    const port = customerPort({ get });
    let store: CustomerStoreValue | undefined;

    render(
      <CustomerStoreProvider initialCustomers={[]} port={port}>
        <CustomerProbe onStore={(nextStore) => (store = nextStore)} />
      </CustomerStoreProvider>,
    );

    await act(async () => {
      void store!.loadCustomer(customerA.id).catch(() => undefined);
      void store!.loadCustomer(customerB.id).catch(() => undefined);
    });
    await act(async () => {
      requestB.resolve(customerB);
      await requestB.promise;
    });
    await waitFor(() => expect(store!.customers).toEqual([customerB]));

    await act(async () => {
      requestA.resolve(customerA);
      await requestA.promise;
    });

    expect(store!.customers).toEqual([customerB]);
  });

  it('ignores an obsolete failure after the customer provider unmounts', async () => {
    const request = deferred<readonly CustomerRecord[]>();
    const onFailure = vi.fn();
    const port = customerPort({ list: vi.fn().mockResolvedValue(request.promise) });
    let store: CustomerStoreValue | undefined;
    const rendered = render(
      <CustomerStoreProvider initialCustomers={[]} port={port} onFailure={onFailure}>
        <CustomerProbe onStore={(nextStore) => (store = nextStore)} />
      </CustomerStoreProvider>,
    );

    let read: Promise<void> | undefined;
    await act(async () => {
      read = store!.refresh();
    });
    rendered.unmount();
    await act(async () => {
      request.reject(new Error('unmounted read failed'));
      await expect(request.promise).rejects.toThrow('unmounted read failed');
      await read;
    });

    expect(onFailure).not.toHaveBeenCalled();
  });

  it('ignores an obsolete event read failure after the event provider unmounts', async () => {
    const request = deferred<readonly CustomerEvent[]>();
    const onFailure = vi.fn();
    const port = eventPort({ list: vi.fn().mockResolvedValue(request.promise) });
    let store: EventStoreValue | undefined;
    const rendered = render(
      <EventStoreProvider initialEvents={[]} port={port} onFailure={onFailure}>
        <EventProbe onStore={(nextStore) => (store = nextStore)} />
      </EventStoreProvider>,
    );

    let read: Promise<void> | undefined;
    await act(async () => {
      read = store!.loadSchedule(rangeA);
    });
    rendered.unmount();
    await act(async () => {
      request.reject(new Error('unmounted event read failed'));
      await expect(request.promise).rejects.toThrow('unmounted event read failed');
      await read;
    });

    expect(onFailure).not.toHaveBeenCalled();
  });
});
