import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { CustomerCard } from '@/components/customers/CustomerCard';
import { CUSTOMER_FIXTURE_RECORDS, landlordTenantScenario } from '@/fixtures/scenarios';
import { I18nProvider } from '@/i18n/I18nContext';

function renderCard(isSelected: boolean) {
  render(
    <MemoryRouter>
      <I18nProvider locale="ko">
        <CustomerCard customer={CUSTOMER_FIXTURE_RECORDS[0]!} isSelected={isSelected} />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('CustomerCard (Foundation 행)', () => {
  it('keeps the data hooks and has no card border or shadow', () => {
    renderCard(false);
    const root = document.querySelector('[data-customer-card]')!;
    expect(root).toHaveAttribute('data-customer-id', landlordTenantScenario.customer.id);
    expect(root.querySelector('a')).toBeInTheDocument();
    for (const el of [root, ...root.querySelectorAll('*')]) {
      expect(el.className).not.toMatch(/\bborder\b|\bshadow/);
    }
  });

  it('shows the workspace name as plain text, not a status badge', () => {
    renderCard(false);
    expect(screen.getByText(landlordTenantScenario.workspace.name)).toBeVisible();
    expect(document.querySelector('[data-slot="badge"]')).toBeNull();
  });

  it('marks the selected row with aria-current plus a brand-subtle face and deep text', () => {
    renderCard(true);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('aria-current', 'true');
    expect(link).toHaveClass('bg-brand-subtle', 'text-brand-deep');
    expect(link).toHaveClass('min-h-11');
    // 색 외 단서: 선택 행 이름은 굵게, 일반 행은 기본 굵기
    expect(screen.getByText(CUSTOMER_FIXTURE_RECORDS[0]!.displayName)).toHaveClass('font-bold');
  });

  it('leaves unselected rows without aria-current', () => {
    renderCard(false);
    expect(screen.getByRole('link')).not.toHaveAttribute('aria-current');
    expect(screen.getByText(CUSTOMER_FIXTURE_RECORDS[0]!.displayName)).not.toHaveClass('font-bold');
  });
});
