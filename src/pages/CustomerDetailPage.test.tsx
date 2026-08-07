import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { landlordTenantScenario } from '@/fixtures/scenarios';
import { I18nProvider } from '@/i18n/I18nContext';
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';

function renderAt(customerId: string) {
  render(
    <MemoryRouter initialEntries={[`/app/customers/${customerId}`]}>
      <I18nProvider locale="ko">
        <Routes>
          <Route path="/app/customers/:customerId" element={<CustomerDetailPage />} />
        </Routes>
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
  });

  it('renders the app not-found surface for an unknown customer id', () => {
    renderAt('does-not-exist');
    expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeVisible();
    expect(screen.queryByText('does-not-exist')).not.toBeInTheDocument();
  });
});
