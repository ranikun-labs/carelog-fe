import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { landlordTenantScenario, CUSTOMER_FIXTURE_RECORDS } from '@/fixtures/scenarios';
import { SCHEDULE_FIXTURE } from '@/fixtures/schedule';
import { I18nProvider } from '@/i18n/I18nContext';
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';

const { eventState } = vi.hoisted(() => ({
  eventState: {
    detailLoadState: 'error',
    detailCustomerId: 'customer-1',
    detailError: new Error('Network unavailable'),
    events: [] as typeof SCHEDULE_FIXTURE.events,
    error: new Error('Network unavailable'),
    remoteReadsEnabled: true,
    loadCustomerDetail: vi.fn().mockResolvedValue(undefined),
    getCustomerSnapshot: vi.fn(),
  },
}));

vi.mock('@/state/EventStoreContext', () => ({ useOptionalEventStore: () => eventState }));

function renderDetail() {
  render(
    <MemoryRouter>
      <I18nProvider locale="ko">
        <CustomerStoreProvider initialCustomers={CUSTOMER_FIXTURE_RECORDS}>
          <CustomerDetailPage customerId={landlordTenantScenario.customer.id} />
        </CustomerStoreProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('customer event loading states', () => {
  beforeEach(() => {
    eventState.detailLoadState = 'error';
    eventState.detailCustomerId = landlordTenantScenario.customer.id;
    eventState.events = [];
    eventState.getCustomerSnapshot.mockReset();
    eventState.loadCustomerDetail.mockClear();
  });

  it('offers retry without showing empty events when the first lookup fails', () => {
    renderDetail();
    expect(screen.getByRole('alert')).toBeVisible();
    expect(screen.queryByText('다음 일정 없음')).not.toBeInTheDocument();
    expect(document.querySelector('[data-customer-history]')).toBeNull();
    eventState.loadCustomerDetail.mockClear();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(eventState.loadCustomerDetail).toHaveBeenCalledTimes(1);
    expect(eventState.loadCustomerDetail).toHaveBeenCalledWith(
      landlordTenantScenario.customer.id,
      expect.any(Date),
    );
  });

  it('keeps the previous snapshot and labels it as stale after a failed refresh', () => {
    eventState.getCustomerSnapshot.mockReturnValue({
      upcoming: SCHEDULE_FIXTURE.events,
      history: [],
    });
    renderDetail();
    expect(
      screen.getByText('최신 일정을 확인하지 못해 이전에 불러온 내용을 표시합니다.'),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: '다음 일정' })).toBeVisible();
  });

  it('does not describe a pending initial lookup as empty', () => {
    eventState.detailLoadState = 'loading';
    renderDetail();
    expect(screen.getByRole('status')).toBeVisible();
    expect(screen.queryByText('다음 일정 없음')).not.toBeInTheDocument();
  });

  it('does not show a previous customer error for the current customer', () => {
    eventState.detailCustomerId = 'different-customer';
    renderDetail();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toBeVisible();
  });

  it('shows known saved events as partial after an unsuccessful lookup', () => {
    eventState.events = SCHEDULE_FIXTURE.events;
    renderDetail();
    expect(screen.getByText('전체 일정을 불러오지 못해 확인된 일정만 표시합니다.')).toBeVisible();
    expect(document.querySelector('[data-customer-history]')).toBeNull();
  });
});
