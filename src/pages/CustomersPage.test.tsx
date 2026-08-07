import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { landlordTenantScenario, therapistPatientScenario } from '@/fixtures/scenarios';
import { I18nProvider } from '@/i18n/I18nContext';
import { CustomersPage } from '@/pages/CustomersPage';

function renderPage() {
  render(
    <MemoryRouter>
      <I18nProvider locale="ko">
        <CustomersPage />
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
    const link = screen.getByRole('link', { name: new RegExp(landlordTenantScenario.customer.displayName) });
    expect(link).toHaveAttribute('href', `/app/customers/${landlordTenantScenario.customer.id}`);
  });
});
