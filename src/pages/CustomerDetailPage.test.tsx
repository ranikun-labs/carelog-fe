import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { CUSTOMER_FIXTURE_RECORDS, landlordTenantScenario } from '@/fixtures/scenarios';
import { SCHEDULE_FIXTURE } from '@/fixtures/schedule';
import { I18nProvider } from '@/i18n/I18nContext';
import { CustomerDetailPage, type CustomerDetailPageProps } from '@/pages/CustomerDetailPage';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';

function renderAt(customerId: string, props: CustomerDetailPageProps = {}) {
  render(
    <MemoryRouter initialEntries={[`/app/customers/${customerId}`]}>
      <I18nProvider locale="ko">
        <CustomerStoreProvider initialCustomers={CUSTOMER_FIXTURE_RECORDS}>
          <Routes>
            <Route
              path="/app/customers/:customerId"
              element={
                <CustomerDetailPage {...props} events={props.events ?? SCHEDULE_FIXTURE.events} />
              }
            />
          </Routes>
        </CustomerStoreProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('CustomerDetailPage', () => {
  it('renders identity, workspace badge, and context for a known customer', () => {
    renderAt(landlordTenantScenario.customer.id);
    expect(
      screen.getByRole('heading', { name: landlordTenantScenario.customer.displayName }),
    ).toBeVisible();
    expect(screen.getByText(landlordTenantScenario.workspace.name)).toBeVisible();
    expect(screen.getByText(landlordTenantScenario.context.summary)).toBeVisible();
    for (const entry of landlordTenantScenario.timeline) {
      expect(screen.getByText(entry.label)).toBeVisible();
    }
    expect(screen.getByRole('button', { name: '일정 추가' })).toBeDisabled();
    expect(screen.getByRole('heading', { name: '다음 일정' })).toBeVisible();
    expect(screen.queryByText('다음 일정 없음')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: '일정 상세 열기: 계약 갱신 여부 재확인' }),
    ).toHaveAttribute('href', '/app/events/followup-tenant-1');
    expect(screen.queryByRole('heading', { name: '메모' })).not.toBeInTheDocument();
  });

  it('renders the app not-found surface for an unknown customer id', () => {
    renderAt('does-not-exist');
    expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeVisible();
    expect(screen.queryByText('does-not-exist')).not.toBeInTheDocument();
  });

  it('renders only explicit memo evidence with bounded presentation', () => {
    renderAt(landlordTenantScenario.customer.id, {
      memo: '고객이 요청한 긴 메모 '.repeat(20),
    });

    expect(screen.getByRole('heading', { name: '메모' })).toBeVisible();
    expect(screen.getByTestId('customer-memo-copy')).toHaveClass('line-clamp-3');
  });
});
