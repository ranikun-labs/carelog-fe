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
    expect(screen.queryByText(landlordTenantScenario.customer.displayName)).not.toBeInTheDocument();
  });
});
