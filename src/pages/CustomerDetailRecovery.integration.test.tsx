import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { CUSTOMER_FIXTURE_RECORDS, landlordTenantScenario } from '@/fixtures/scenarios';
import { I18nProvider } from '@/i18n/I18nContext';
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';
import { EventCreateDraftProvider } from '@/state/EventCreateDraftContext';
import {
  EventCreateActivationProvider,
  useEventCreateActivation,
} from '@/state/EventCreateActivationContext';
import { EventStoreProvider, useEventStore } from '@/state/EventStoreContext';

it('shows a confirmed new event as partial when the first read and refresh fail', async () => {
  const customer = landlordTenantScenario.customer;
  const port = {
    list: vi.fn().mockRejectedValue(new Error('Read unavailable')),
    get: vi.fn(),
    create: vi.fn().mockResolvedValue({
      id: 'created-after-read-error',
      customerId: customer.id,
      status: 'PLANNED',
      scheduledAt: '2026-08-20T10:00:00+09:00',
      descriptor: '생성된 연락',
    }),
    edit: vi.fn(),
    occur: vi.fn(),
    cancel: vi.fn(),
  };
  render(
    <MemoryRouter>
      <I18nProvider locale="ko">
        <CustomerStoreProvider initialCustomers={CUSTOMER_FIXTURE_RECORDS}>
          <EventStoreProvider port={port}>
            <CustomerDetailPage
              customerId={customer.id}
              now={new Date('2026-08-11T12:00:00+09:00')}
            />
          </EventStoreProvider>
        </CustomerStoreProvider>
      </I18nProvider>
    </MemoryRouter>,
  );

  await screen.findByRole('alert');
  expect(screen.queryByText('다음 일정 없음')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '일정 추가' }));
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '생성된 연락' } });
  fireEvent.change(screen.getByLabelText('예정 시각'), { target: { value: '2026-08-20T10:00' } });
  fireEvent.click(document.querySelector<HTMLButtonElement>('[data-event-form-submit]')!);
  await waitFor(() => expect(port.create).toHaveBeenCalledTimes(1));
  expect(
    await screen.findByText('전체 일정을 불러오지 못해 확인된 일정만 표시합니다.'),
  ).toBeVisible();
  expect(screen.getByRole('link', { name: /일정 상세 열기: 생성된 연락/ })).toBeVisible();
  expect(document.querySelector('[data-customer-history]')).toBeNull();
});

it('does not refresh or navigate the previous customer after a pending create resolves', async () => {
  const customerA = landlordTenantScenario.customer;
  const customerB = CUSTOMER_FIXTURE_RECORDS.find((customer) => customer.id !== customerA.id)!;
  let resolveCreate!: (value: {
    id: string;
    customerId: string;
    status: 'PLANNED';
    scheduledAt: string;
    descriptor: string;
  }) => void;
  const createPending = new Promise<{
    id: string;
    customerId: string;
    status: 'PLANNED';
    scheduledAt: string;
    descriptor: string;
  }>((resolve) => {
    resolveCreate = resolve;
  });
  const port = {
    list: vi
      .fn()
      .mockImplementation(({ customerId }: { customerId: string }) =>
        customerId === customerA.id
          ? Promise.reject(new Error('Read unavailable'))
          : Promise.resolve([]),
      ),
    get: vi.fn(),
    create: vi.fn().mockReturnValue(createPending),
    edit: vi.fn(),
    occur: vi.fn(),
    cancel: vi.fn(),
  };
  const renderView = (customerId: string) => (
    <MemoryRouter>
      <I18nProvider locale="ko">
        <CustomerStoreProvider initialCustomers={CUSTOMER_FIXTURE_RECORDS}>
          <EventStoreProvider port={port}>
            <CustomerDetailPage
              customerId={customerId}
              now={new Date('2026-08-11T12:00:00+09:00')}
            />
          </EventStoreProvider>
        </CustomerStoreProvider>
      </I18nProvider>
    </MemoryRouter>
  );
  const view = render(renderView(customerA.id));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: '일정 추가' }));
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '늦은 일정' } });
  fireEvent.click(document.querySelector<HTMLButtonElement>('[data-event-form-submit]')!);
  await waitFor(() => expect(port.create).toHaveBeenCalledTimes(1));
  view.rerender(renderView(customerB.id));
  await screen.findByRole('heading', { name: customerB.displayName });
  await screen.findByText('다음 일정 없음');
  const before = port.list.mock.calls.filter(([query]) => query.customerId === customerA.id).length;
  resolveCreate({
    id: 'delayed-event',
    customerId: customerA.id,
    status: 'PLANNED',
    scheduledAt: '2026-08-20T10:00:00+09:00',
    descriptor: '늦은 일정',
  });
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: customerB.displayName })).toBeVisible(),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(port.list.mock.calls.filter(([query]) => query.customerId === customerA.id)).toHaveLength(
    before,
  );
  expect(screen.getByText('다음 일정 없음')).toBeVisible();
  expect(document.querySelector('[data-event-form]')).toBeNull();
});

it('moves focus from retry to the loading status while a retry is pending', async () => {
  const customer = landlordTenantScenario.customer;
  const pending = new Promise<never>(() => {});
  const port = {
    list: vi.fn().mockRejectedValueOnce(new Error('Read unavailable')).mockReturnValue(pending),
    get: vi.fn(),
    create: vi.fn(),
    edit: vi.fn(),
    occur: vi.fn(),
    cancel: vi.fn(),
  };
  render(
    <MemoryRouter>
      <I18nProvider locale="ko">
        <CustomerStoreProvider initialCustomers={CUSTOMER_FIXTURE_RECORDS}>
          <EventStoreProvider port={port}>
            <CustomerDetailPage customerId={customer.id} />
          </EventStoreProvider>
        </CustomerStoreProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveFocus());
});

it.each([false, true])(
  'keeps appropriate focus when retry succeeds (user moved: %s)',
  async (moved) => {
    const customer = landlordTenantScenario.customer;
    let finishRetry!: (events: never[]) => void;
    const retry = new Promise<never[]>((resolve) => {
      finishRetry = resolve;
    });
    const never = new Promise<never>(() => {});
    const port = {
      list: vi
        .fn()
        .mockRejectedValueOnce(new Error('Read unavailable'))
        .mockReturnValueOnce(never)
        .mockReturnValue(retry),
      get: vi.fn(),
      create: vi.fn(),
      edit: vi.fn(),
      occur: vi.fn(),
      cancel: vi.fn(),
    };
    render(
      <MemoryRouter>
        <I18nProvider locale="ko">
          <CustomerStoreProvider initialCustomers={CUSTOMER_FIXTURE_RECORDS}>
            <EventStoreProvider port={port}>
              <CustomerDetailPage customerId={customer.id} />
            </EventStoreProvider>
          </CustomerStoreProvider>
        </I18nProvider>
      </MemoryRouter>,
    );
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveFocus());
    const add = screen.getByRole('button', { name: '일정 추가' });
    if (moved) add.focus();
    finishRetry([]);
    await screen.findByText('일정을 다시 불러왔습니다.');
    if (moved) expect(add).toHaveFocus();
    else expect(screen.getByRole('status')).toHaveFocus();
  },
);

it.each([false, true])(
  'preserves known events without claiming a failed refresh is empty (has event: %s)',
  async (hasEvent) => {
    const customer = landlordTenantScenario.customer;
    const now = new Date('2026-08-11T12:00:00+09:00');
    const event = {
      id: 'known',
      customerId: customer.id,
      status: 'PLANNED' as const,
      scheduledAt: '2026-08-20T10:00:00+09:00',
      descriptor: '기존 일정',
    };
    const port = {
      list: vi
        .fn()
        .mockResolvedValueOnce(hasEvent ? [event] : [])
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('Read unavailable'))
        .mockResolvedValueOnce([])
        .mockResolvedValue([]),
      get: vi.fn(),
      create: vi.fn(),
      edit: vi.fn(),
      occur: vi.fn(),
      cancel: vi.fn(),
    };
    function Refresh() {
      const store = useEventStore();
      return (
        <button
          onClick={() => void store.loadCustomerDetail(customer.id, now).catch(() => undefined)}
        >
          refresh
        </button>
      );
    }
    render(
      <MemoryRouter>
        <I18nProvider locale="ko">
          <CustomerStoreProvider initialCustomers={CUSTOMER_FIXTURE_RECORDS}>
            <EventStoreProvider port={port}>
              <Refresh />
              <CustomerDetailPage customerId={customer.id} now={now} />
            </EventStoreProvider>
          </CustomerStoreProvider>
        </I18nProvider>
      </MemoryRouter>,
    );
    if (hasEvent) await screen.findByRole('link', { name: /일정 상세 열기: 기존 일정/ });
    else await screen.findByText('다음 일정 없음');
    fireEvent.click(screen.getByRole('button', { name: 'refresh' }));
    await screen.findByRole('alert');
    expect(screen.queryByText('다음 일정 없음')).not.toBeInTheDocument();
    expect(document.querySelector('[data-customer-history]')).toBeInTheDocument();
    if (hasEvent)
      expect(screen.getByRole('link', { name: /일정 상세 열기: 기존 일정/ })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('다음 일정 없음')).toBeVisible();
  },
);

it('preserves an inline customer event draft across a responsive remount', async () => {
  const customer = landlordTenantScenario.customer;
  function RemountableDetail() {
    const [version, setVersion] = useState(0);
    return (
      <>
        <button onClick={() => setVersion((value) => value + 1)}>rotate</button>
        <CustomerDetailPage
          key={version}
          customerId={customer.id}
          now={new Date('2026-08-11T12:00:00+09:00')}
        />
      </>
    );
  }
  render(
    <MemoryRouter>
      <I18nProvider locale="ko">
        <CustomerStoreProvider initialCustomers={CUSTOMER_FIXTURE_RECORDS}>
          <EventStoreProvider initialEvents={[]}>
            <EventCreateDraftProvider>
              <RemountableDetail />
            </EventCreateDraftProvider>
          </EventStoreProvider>
        </CustomerStoreProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: '일정 추가' }));
  fireEvent.change(screen.getByLabelText('제목'), { target: { value: '회전 전 제목' } });
  fireEvent.change(screen.getByLabelText('예정 시각'), { target: { value: '2026-08-20T10:00' } });
  fireEvent.change(screen.getByLabelText('메모'), { target: { value: '회전 전 메모' } });
  fireEvent.click(screen.getByRole('button', { name: 'rotate' }));
  expect(screen.getByLabelText('제목')).toHaveValue('회전 전 제목');
  expect(screen.getByLabelText('예정 시각')).toHaveValue('2026-08-20T10:00');
  expect(screen.getByLabelText('메모')).toHaveValue('회전 전 메모');
  fireEvent.change(screen.getByLabelText('예정 시각'), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'rotate' }));
  expect(screen.getByLabelText('예정 시각')).toHaveValue('');
});

it.each(['rotate', 'change customer and return'] as const)(
  'scopes a pending create across %s',
  async (scenario) => {
    const customer = landlordTenantScenario.customer;
    let resolveCreate!: (event: import('@/domain/customerEvent').CustomerEvent) => void;
    const createEvent = vi.fn(
      () =>
        new Promise<import('@/domain/customerEvent').CustomerEvent>((resolve) => {
          resolveCreate = resolve;
        }),
    );
    let activation!: ReturnType<typeof useEventCreateActivation>;
    function Detail() {
      const [version, setVersion] = useState(0);
      const [selectedCustomer, setSelectedCustomer] = useState(customer.id);
      activation = useEventCreateActivation();
      return (
        <>
          <button onClick={() => setVersion((v) => v + 1)}>rotate</button>
          <button
            onClick={() =>
              setSelectedCustomer((id) => (id === customer.id ? 'another-customer' : customer.id))
            }
          >
            change customer
          </button>
          <CustomerDetailPage
            key={version}
            customerId={selectedCustomer}
            onCreateEvent={createEvent}
            now={new Date('2026-08-11T12:00:00+09:00')}
          />
        </>
      );
    }
    render(
      <MemoryRouter>
        <I18nProvider locale="ko">
          <CustomerStoreProvider initialCustomers={CUSTOMER_FIXTURE_RECORDS}>
            <EventCreateActivationProvider>
              <EventCreateDraftProvider>
                <Detail />
              </EventCreateDraftProvider>
            </EventCreateActivationProvider>
          </CustomerStoreProvider>
        </I18nProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: '일정 추가' }));
    fireEvent.change(screen.getByLabelText('제목'), { target: { value: '회전 저장' } });
    fireEvent.change(screen.getByLabelText('예정 시각'), { target: { value: '2026-08-20T10:00' } });
    activation.recordCreateActivation({ kind: 'programmatic' });
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-event-form-submit]')!);
    await waitFor(() => expect(createEvent).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'rotate' }));
    if (scenario === 'change customer and return') {
      fireEvent.click(screen.getByRole('button', { name: 'change customer' }));
      fireEvent.click(screen.getByRole('button', { name: 'change customer' }));
    }
    await act(async () => {
      resolveCreate({
        id: 'created',
        customerId: customer.id,
        status: 'PLANNED',
        scheduledAt: '2026-08-20T10:00:00+09:00',
        descriptor: '회전 저장',
      });
    });
    if (scenario === 'rotate') {
      expect(activation.getPendingCreateReturn()?.target).toEqual({
        kind: 'customer-detail',
        customerId: customer.id,
        eventId: 'created',
      });
    } else {
      expect(activation.getPendingCreateReturn()).toBeNull();
    }
  },
);
