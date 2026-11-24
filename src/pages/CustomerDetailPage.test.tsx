import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { CUSTOMER_FIXTURE_RECORDS, landlordTenantScenario } from '@/fixtures/scenarios';
import { SCHEDULE_FIXTURE } from '@/fixtures/schedule';
import { I18nProvider } from '@/i18n/I18nContext';
import { CustomerDetailPage, type CustomerDetailPageProps } from '@/pages/CustomerDetailPage';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';

const TEST_NOW = new Date('2026-08-11T12:00:00+09:00');

function renderAt(customerId: string, props: CustomerDetailPageProps = {}) {
  render(
    <MemoryRouter initialEntries={[`/app/customers/${customerId}`]}>
      <I18nProvider locale="ko">
        <CustomerStoreProvider initialCustomers={CUSTOMER_FIXTURE_RECORDS}>
          <Routes>
            <Route
              path="/app/customers/:customerId"
              element={
                <CustomerDetailPage
                  {...props}
                  now={props.now ?? TEST_NOW}
                  events={props.events ?? SCHEDULE_FIXTURE.events}
                />
              }
            />
          </Routes>
        </CustomerStoreProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('CustomerDetailPage', () => {
  it.each(['PLANNED', 'OCCURRED'] as const)(
    'returns keyboard focus to the existing add-event trigger after cancelling %s entry',
    (status) => {
      const createEvent = vi.fn();
      renderAt(landlordTenantScenario.customer.id, { onCreateEvent: createEvent });
      const trigger = screen.getByRole('button', { name: '일정 추가' });
      trigger.focus();
      fireEvent.click(trigger);
      if (status === 'OCCURRED') fireEvent.click(screen.getByRole('radio', { name: '지금 기록' }));
      const cancel = document.querySelector<HTMLButtonElement>('[data-event-form-cancel]')!;
      cancel.focus();
      expect(cancel).toHaveFocus();
      fireEvent.click(cancel);
      expect(document.querySelector('[data-event-form]')).toBeNull();
      expect(trigger).toHaveFocus();
      expect(createEvent).not.toHaveBeenCalled();
    },
  );

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

  it('uses inset faces without borders and keeps the workspace as text, with no dark button', () => {
    renderAt(landlordTenantScenario.customer.id, { memo: '짧은 메모' });
    const container = document.body;

    expect(screen.getByTestId('customer-memo-copy')).toHaveClass('bg-inset', 'rounded-inset');
    expect(container.querySelector('[data-slot="badge"][class*="bg-brand-subtle"]')).toBeNull();
    expect(screen.getByText(landlordTenantScenario.workspace.name).tagName).toBe('P');
    expect(container.querySelector('[data-add-event]')).not.toHaveClass('bg-primary');
    expect(container.querySelector('[data-assistant-entry="customer"]')).not.toHaveClass(
      'bg-primary',
    );
    expect(
      container.querySelector('[data-customer-detail-page] [class*="border-border-"]'),
    ).toBeNull();
  });

  it('orders context, next event Key Block, memo, then timeline, with no Strong button', () => {
    renderAt(landlordTenantScenario.customer.id, { memo: '짧은 메모' });

    const order = [
      '[data-customer-identity]',
      '[data-customer-upcoming]',
      '[data-customer-memo]',
      '[data-customer-history]',
    ].map((selector) => document.querySelector(selector)!);
    for (let index = 0; index < order.length - 1; index += 1) {
      expect(
        order[index]!.compareDocumentPosition(order[index + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(document.querySelector('[data-customer-detail-page] [class*="bg-primary"]')).toBeNull();
  });

  it('puts the add-event Subtle action inside the next-event Key Block and the AI entry in the header', () => {
    renderAt(landlordTenantScenario.customer.id);

    const keyBlock = document.querySelector('[data-upcoming-key]')!;
    const add = screen.getByRole('button', { name: '일정 추가' });
    expect(keyBlock).toContainElement(add);
    expect(add).toHaveClass('bg-brand-subtle');
    expect(keyBlock.querySelectorAll('time.type-key-value')).toHaveLength(1);

    const ai = document.querySelector<HTMLElement>('[data-assistant-entry="customer"]')!;
    expect(document.querySelector('[data-customer-identity]')).toContainElement(ai);
    expect(keyBlock).not.toContainElement(ai);
    expect(ai).toHaveClass('bg-control', 'min-h-11');
  });
});
