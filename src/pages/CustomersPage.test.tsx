import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { landlordTenantScenario, therapistPatientScenario } from '@/fixtures/scenarios';
import { I18nProvider } from '@/i18n/I18nContext';
import { CustomersPage } from '@/pages/CustomersPage';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';

function renderPage() {
  render(
    <MemoryRouter>
      <I18nProvider locale="ko">
        <CustomerStoreProvider>
          <CustomersPage />
        </CustomerStoreProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('CustomersPage', () => {
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
    expect(screen.getByRole('link', { name: '첫 고객 추가' })).toHaveAttribute(
      'href',
      '/app/customers/new',
    );
    expect(screen.queryByText(landlordTenantScenario.customer.displayName)).not.toBeInTheDocument();
  });
});
