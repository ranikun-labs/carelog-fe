import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { CUSTOMER_FIXTURE_RECORDS, landlordTenantScenario } from '@/fixtures/scenarios';
import { I18nProvider } from '@/i18n/I18nContext';
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';
import { EventStoreProvider } from '@/state/EventStoreContext';

// 저장 알림 영역도 role=status(항상 렌더)라서, 로딩·복구 상태 영역만 골라 본다.
function loadingStatus() {
  return screen.getAllByRole('status').find((el) => !el.hasAttribute('data-event-saved-notice'))!;
}

beforeEach(() => {
  // 픽스처의 기준 시각(2026-08-11)으로 고정한다. 새 일정 과거 시각 검사가 실제 현재 시각을 보기 때문이다.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-08-11T12:00:00+09:00'));
});

afterEach(() => {
  vi.useRealTimers();
});

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
  expect(screen.getByRole('link', { name: '일정 상세 열기: 생성된 연락' })).toBeVisible();
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
  await waitFor(() => expect(loadingStatus()).toHaveFocus());
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
    await waitFor(() => expect(loadingStatus()).toHaveFocus());
    const add = screen.getByRole('button', { name: '일정 추가' });
    if (moved) add.focus();
    finishRetry([]);
    await screen.findByText('일정을 다시 불러왔습니다.');
    if (moved) expect(add).toHaveFocus();
    else expect(loadingStatus()).toHaveFocus();
  },
);
