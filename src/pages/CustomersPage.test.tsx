import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

import {
  CUSTOMER_FIXTURE_RECORDS,
  landlordTenantScenario,
  therapistPatientScenario,
} from '@/fixtures/scenarios';
import type { CustomerPort } from '@/integrations/carelog/customerPort';
import { CarelogHttpError } from '@/integrations/carelog/errors';
import { I18nProvider } from '@/i18n/I18nContext';
import { CustomersPage } from '@/pages/CustomersPage';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';
import type { CustomerRecord } from '@/types/customer';

function createCustomerPort(list: CustomerPort['list']): CustomerPort {
  return {
    list,
    get: vi.fn(),
    create: vi.fn(),
    edit: vi.fn(),
  };
}

function renderRemotePage(port: CustomerPort) {
  render(
    <MemoryRouter initialEntries={['/app/customers']}>
      <I18nProvider locale="ko">
        <CustomerStoreProvider port={port}>
          <CustomersPage />
        </CustomerStoreProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

function renderPage() {
  render(
    <MemoryRouter>
      <I18nProvider locale="ko">
        <CustomerStoreProvider initialCustomers={CUSTOMER_FIXTURE_RECORDS}>
          <CustomersPage />
        </CustomerStoreProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('CustomersPage', () => {
  it('keeps remote loading separate from the customer-empty projection', () => {
    const port = createCustomerPort(vi.fn(() => new Promise<readonly CustomerRecord[]>(() => {})));
    renderRemotePage(port);

    expect(screen.getByRole('status')).toBeVisible();
    expect(screen.queryByText('아직 고객이 없습니다')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '첫 고객 추가' })).not.toBeInTheDocument();
  });

  it('keeps remote error separate from loading and empty actions', async () => {
    const port = createCustomerPort(vi.fn().mockRejectedValue(new CarelogHttpError(503)));
    renderRemotePage(port);

    await waitFor(() =>
      expect(
        screen.getByText('서비스가 잠시 응답하지 않습니다. 데이터는 보존됩니다.'),
      ).toBeVisible(),
    );
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeVisible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '첫 고객 추가' })).not.toBeInTheDocument();
  });

  it('promotes the non-empty create entrypoint to the primary CTA', () => {
    renderPage();

    const cta = screen.getByRole('link', { name: '+ 고객 추가' });
    expect(cta).toHaveAttribute('href', '/app/customers/new');
    expect(cta).toHaveAttribute('data-customer-add-cta');
    expect(cta).toHaveClass('bg-accent-primary', 'min-h-11');
    expect(cta).toHaveClass(
      'focus-visible:outline-2',
      'focus-visible:outline-offset-2',
      'focus-visible:outline-accent-primary',
    );
    expect(screen.queryByRole('link', { name: '첫 고객 추가' })).not.toBeInTheDocument();
  });

  it('lists both scenario customers with their workspace as a scenario badge', () => {
    renderPage();
    expect(screen.getByText(landlordTenantScenario.customer.displayName)).toBeVisible();
    expect(screen.getByText(therapistPatientScenario.customer.displayName)).toBeVisible();
    expect(screen.getByText(landlordTenantScenario.workspace.name)).toBeVisible();
    expect(screen.getByText(therapistPatientScenario.workspace.name)).toBeVisible();
  });

  it('links each customer to its detail route', () => {
    renderPage();
    const link = screen.getByRole('link', {
      name: new RegExp(landlordTenantScenario.customer.displayName),
    });
    expect(link).toHaveAttribute('href', `/app/customers/${landlordTenantScenario.customer.id}`);
  });

  it('renders the first-use empty state without injecting a fixture customer', () => {
    render(
      <MemoryRouter initialEntries={['/app/customers']}>
        <I18nProvider locale="ko">
          <CustomerStoreProvider initialCustomers={[]}>
            <CustomersPage />
          </CustomerStoreProvider>
        </I18nProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('아직 고객이 없습니다')).toBeVisible();
    const cta = screen.getByRole('link', { name: '첫 고객 추가' });
    expect(cta).toHaveAttribute('href', '/app/customers/new');
    expect(cta).toHaveClass('bg-accent-primary', 'min-h-[54px]');
    expect(screen.queryByRole('link', { name: '+ 고객 추가' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /고객 추가/ })).toHaveLength(1);
    expect(screen.queryByText(landlordTenantScenario.customer.displayName)).not.toBeInTheDocument();
  });
});
