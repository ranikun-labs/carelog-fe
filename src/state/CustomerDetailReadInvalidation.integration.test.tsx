import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { expect, it, vi } from 'vitest';

import type { CustomerEvent } from '@/domain/customerEvent';
import { I18nProvider } from '@/i18n/I18nContext';
import type { CustomerEventPort } from '@/integrations/carelog/customerEventPort';
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';
import { EventStoreProvider, type EventStoreValue, useEventStore } from '@/state/EventStoreContext';

function pendingValue<T>() {
  let finish!: (value: T) => void;
  let fail!: (reason: Error) => void;
  const promise = new Promise<T>((resolve, reject) => {
    finish = resolve;
    fail = reject;
  });
  return { promise, finish, fail };
}
const customer = { id: 'customer-detail-0706', displayName: '경합 검증 고객' };
const now = new Date('2027-01-05T10:00:00Z');
const confirmed: CustomerEvent = {
  id: 'confirmed-0706',
  customerId: customer.id,
  status: 'PLANNED',
  scheduledAt: '2027-01-06T10:00:00Z',
  descriptor: '서버 확인 일정',
};
const previous: CustomerEvent = {
  id: 'history-0706',
  customerId: customer.id,
  status: 'OCCURRED',
  occurredAt: '2027-01-04T10:00:00Z',
  descriptor: '기존 기록',
};
function portWith(list: CustomerEventPort['list']): CustomerEventPort {
  return {
    list,
    create: vi.fn().mockResolvedValue(confirmed),
    get: vi.fn(),
    edit: vi.fn(),
    occur: vi.fn(),
    cancel: vi.fn(),
  };
}

it.each(['success', 'failure'] as const)(
  'finishes the detail snapshot after a save invalidates the first read (%s)',
  async (settlement) => {
    const old = pendingValue<readonly CustomerEvent[]>();
    let remainingInitial = 2;
    const list = vi.fn<CustomerEventPort['list']>((query) =>
      remainingInitial-- > 0 ? old.promise : Promise.resolve(query.from ? [confirmed] : [previous]),
    );
    const port = portWith(list);
    let current!: EventStoreValue;
    function Observe() {
      current = useEventStore();
      return null;
    }
    render(
      <MemoryRouter>
        <I18nProvider locale="ko">
          <CustomerStoreProvider initialCustomers={[customer]}>
            <EventStoreProvider port={port}>
              <Observe />
              <CustomerDetailPage customerId={customer.id} now={now} />
            </EventStoreProvider>
          </CustomerStoreProvider>
        </I18nProvider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('status')).toHaveTextContent('일정을 불러오는 중');
    fireEvent.click(document.querySelector('[data-add-event]')!);
    fireEvent.change(document.querySelector('[data-event-field="descriptor"]')!, {
      target: { value: confirmed.descriptor },
    });
    fireEvent.change(document.querySelector('[data-event-field="scheduledAt"]')!, {
      target: { value: '2027-01-06T10:00' },
    });
    fireEvent.click(document.querySelector('[data-event-form-submit]')!);
    await waitFor(() => expect(current.events).toContainEqual(confirmed));
    expect(port.create).toHaveBeenCalledTimes(1);
    await act(async () => {
      if (settlement === 'success') old.finish([]);
      else old.fail(new Error('old read failed'));
      await Promise.allSettled([old.promise]);
    });
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(screen.getByRole('link', { name: '일정 상세 열기: 서버 확인 일정' })).toBeVisible();
    expect(current.getCustomerSnapshot(customer.id)).toEqual({
      upcoming: [confirmed],
      history: [previous],
    });
    expect(current.error).toBeNull();
    expect(list).toHaveBeenCalledTimes(4);
  },
);

function mountStore(port: CustomerEventPort, assertSessionOwner?: () => void) {
  let value!: EventStoreValue;
  function Observe() {
    value = useEventStore();
    return null;
  }
  const view = render(
    <EventStoreProvider port={port} assertSessionOwner={assertSessionOwner}>
      <Observe />
    </EventStoreProvider>,
  );
  return { value: () => value, ...view };
}
async function save(value: () => EventStoreValue) {
  await act(async () => {
    await value().createEvent({
      status: 'PLANNED',
      customerId: customer.id,
      scheduledAt: confirmed.scheduledAt!,
    });
  });
}

it('reports a fresh read failure once and retains the previously loaded history', async () => {
  const old = pendingValue<readonly CustomerEvent[]>();
  const unavailable = new Error('readback unavailable');
  const list = vi
    .fn<CustomerEventPort['list']>()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([previous])
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(old.promise)
    .mockRejectedValueOnce(unavailable)
    .mockResolvedValueOnce([]);
  const { value } = mountStore(portWith(list));
  await act(async () => {
    await value().loadCustomerDetail(customer.id, now);
  });
  let read!: Promise<void>;
  await act(async () => {
    read = value()
      .loadCustomerDetail(customer.id, now)
      .catch((error) => {
        expect(error).toBe(unavailable);
      });
  });
  await save(value);
  await act(async () => {
    old.finish([]);
    await read;
  });
  expect(value().detailLoadState).toBe('error');
  expect(value().error).toBe(unavailable);
  expect(value().getCustomerSnapshot(customer.id)?.history).toEqual([previous]);
  expect(value().events).toContainEqual(confirmed);
  expect(list).toHaveBeenCalledTimes(6);
});

it('lets a newer detail request own completion without starting an obsolete refetch', async () => {
  const old = pendingValue<readonly CustomerEvent[]>();
  const newest = pendingValue<readonly CustomerEvent[]>();
  const list = vi
    .fn<CustomerEventPort['list']>()
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(newest.promise)
    .mockResolvedValueOnce([previous]);
  const { value } = mountStore(portWith(list));
  let first!: Promise<void>;
  let last!: Promise<void>;
  await act(async () => {
    first = value().loadCustomerDetail(customer.id, now);
  });
  await save(value);
  await act(async () => {
    last = value().loadCustomerDetail(customer.id, now);
  });
  await act(async () => {
    old.finish([]);
    await first;
  });
  expect(list).toHaveBeenCalledTimes(4);
  expect(value().detailLoadState).toBe('loading');
  await act(async () => {
    newest.finish([confirmed]);
    await last;
  });
  expect(value().getCustomerSnapshot(customer.id)).toEqual({
    upcoming: [confirmed],
    history: [previous],
  });
  expect(value().detailLoadState).toBe('ready');
});

it('ignores the refetch failure after a newer request has already succeeded', async () => {
  const old = pendingValue<readonly CustomerEvent[]>();
  const refetch = pendingValue<readonly CustomerEvent[]>();
  const list = vi
    .fn<CustomerEventPort['list']>()
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(old.promise)
    .mockReturnValueOnce(refetch.promise)
    .mockReturnValueOnce(refetch.promise)
    .mockResolvedValueOnce([confirmed])
    .mockResolvedValueOnce([previous]);
  const { value } = mountStore(portWith(list));
  let read!: Promise<void>;
  await act(async () => {
    read = value().loadCustomerDetail(customer.id, now);
  });
  await save(value);
  await act(async () => {
    old.finish([]);
  });
  expect(list).toHaveBeenCalledTimes(4);
  await act(async () => {
    await value().loadCustomerDetail(customer.id, now);
  });
  await act(async () => {
    refetch.fail(new Error('superseded refetch failed'));
    await read;
  });
  expect(value().error).toBeNull();
  expect(value().detailLoadState).toBe('ready');
  expect(value().getCustomerSnapshot(customer.id)).toEqual({
    upcoming: [confirmed],
    history: [previous],
  });
  expect(list).toHaveBeenCalledTimes(6);
});

it.each(['session', 'unmount'] as const)(
  'discards a pending refetch after %s ownership ends',
  async (boundary) => {
    const old = pendingValue<readonly CustomerEvent[]>();
    const refetch = pendingValue<readonly CustomerEvent[]>();
    const list = vi
      .fn<CustomerEventPort['list']>()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(refetch.promise)
      .mockReturnValueOnce(refetch.promise);
    let owner = true;
    const { value, unmount } = mountStore(portWith(list), () => {
      if (!owner) throw new Error('session expired');
    });
    let read!: Promise<void>;
    await act(async () => {
      read = value().loadCustomerDetail(customer.id, now);
    });
    await save(value);
    await act(async () => {
      old.finish([]);
    });
    expect(list).toHaveBeenCalledTimes(4);
    if (boundary === 'session') owner = false;
    else unmount();
    await act(async () => {
      refetch.fail(new Error('late refetch failure'));
      await read;
    });
    expect(value().error).toBeNull();
    expect(value().getCustomerSnapshot(customer.id)).toBeUndefined();
    expect(list).toHaveBeenCalledTimes(4);
  },
);

it('does not automatically retry an ordinary read failure', async () => {
  const error = new Error('ordinary read error');
  const list = vi
    .fn<CustomerEventPort['list']>()
    .mockRejectedValueOnce(error)
    .mockResolvedValueOnce([]);
  const { value } = mountStore(portWith(list));
  await act(async () => {
    await expect(value().loadCustomerDetail(customer.id, now)).rejects.toBe(error);
  });
  expect(value().error).toBe(error);
  expect(value().detailLoadState).toBe('error');
  expect(list).toHaveBeenCalledTimes(2);
});

it('does not invalidate the detail read when saving fails', async () => {
  const old = pendingValue<readonly CustomerEvent[]>();
  const error = new Error('save rejected');
  const list = vi.fn<CustomerEventPort['list']>().mockReturnValue(old.promise);
  const port = portWith(list);
  port.create = vi.fn().mockRejectedValue(error);
  const { value } = mountStore(port);
  let read!: Promise<void>;
  await act(async () => {
    read = value().loadCustomerDetail(customer.id, now);
  });
  await act(async () => {
    await expect(
      value().createEvent({
        status: 'PLANNED',
        customerId: customer.id,
        scheduledAt: confirmed.scheduledAt!,
      }),
    ).rejects.toBe(error);
  });
  await act(async () => {
    old.finish([]);
    await read;
  });
  expect(value().error).toBe(error);
  expect(value().detailLoadState).toBe('ready');
  expect(list).toHaveBeenCalledTimes(2);
  expect(value().events).not.toContainEqual(confirmed);
});
