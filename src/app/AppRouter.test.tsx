import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { AppRouter } from '@/app/AppRouter';

describe('application router', () => {
  it('renders the schedule at the app entry and schedule path', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/app']}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '일정' })).toBeVisible();
    unmount();
    render(
      <MemoryRouter initialEntries={['/app/schedule']}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '일정' })).toBeVisible();
  });

  it('resolves a canonical event id on the event detail route', () => {
    render(
      <MemoryRouter initialEntries={['/app/events/event-tenant-transitioned']}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '계약 갱신 상담' })).toBeVisible();
    expect(screen.getByText('예정')).toBeVisible();
    expect(screen.getByText('실제')).toBeVisible();
  });

  it('redirects root to the Korean public home', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(
      await screen.findByRole('heading', { name: /고객 맥락과 후속 업무/ }),
    ).toBeInTheDocument();
  });

  it('renders English and unsupported public locale boundaries', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/en/features']}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: 'A verifiable customer management foundation' }),
    ).toBeVisible();
    unmount();
    render(
      <MemoryRouter initialEntries={['/fr']}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeVisible();
  });

  it('marks Customers active while on the customers list route', () => {
    render(
      <MemoryRouter initialEntries={['/app/customers']}>
        <AppRouter />
      </MemoryRouter>,
    );
    const activeCustomerLink = screen
      .getAllByRole('link', { name: '고객' })
      .find((link) => link.getAttribute('aria-current') === 'page');
    expect(activeCustomerLink).toHaveAttribute('aria-current', 'page');
  });

  it('resolves a known customer id on the detail route via the shared fixtures', () => {
    render(
      <MemoryRouter initialEntries={['/app/customers/customer-tenant-1']}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByText('박세입')).toBeVisible();
    expect(document.querySelectorAll('[data-scroll-surface]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-bottom-navigation]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-side-navigation]')).toHaveLength(1);
  });

  it('renders the app not-found surface for an unknown customer id', () => {
    render(
      <MemoryRouter initialEntries={['/app/customers/does-not-exist']}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeVisible();
  });

  it('renders the customer import and handoff placeholder routes', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/app/customers/c-1/import']}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '고객 가져오기' })).toBeVisible();
    unmount();
    render(
      <MemoryRouter initialEntries={['/app/customers/c-1/handoff']}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '인계' })).toBeVisible();
  });

  it('renders the review detail placeholder route', () => {
    render(
      <MemoryRouter initialEntries={['/app/reviews/r-1']}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '검토' })).toBeVisible();
  });

  it('renders the follow-ups placeholder route', () => {
    render(
      <MemoryRouter initialEntries={['/app/follow-ups']}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '후속 업무' })).toBeVisible();
  });

  it('supports first-use create, detail resolution, and edit propagation from one Customer state', async () => {
    render(
      <MemoryRouter initialEntries={['/app/customers']}>
        <AppRouter initialCustomers={[]} initialEvents={[]} />
      </MemoryRouter>,
    );

    expect(screen.getByText('아직 고객이 없습니다')).toBeVisible();
    fireEvent.click(screen.getByRole('link', { name: '첫 고객 추가' }));
    expect(screen.getByRole('heading', { name: '첫 고객 추가' })).toBeVisible();

    fireEvent.change(screen.getByLabelText('고객 이름'), {
      target: { value: '첫 번째 고객' },
    });
    fireEvent.change(screen.getByLabelText('고객 메모'), {
      target: { value: '직접 작성한 메모' },
    });
    fireEvent.click(screen.getByRole('button', { name: '고객 추가' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '첫 번째 고객' })).toBeVisible(),
    );
    expect(screen.getByTestId('customer-memo-copy')).toHaveTextContent('직접 작성한 메모');
    expect(
      screen.queryByRole('heading', { name: '페이지를 찾을 수 없습니다' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '일정 추가' })).toBeEnabled();

    const detail = screen.getByTestId('customer-memo-copy').closest('[data-customer-detail-page]');
    const customerId = detail?.getAttribute('data-selected-customer-id');
    expect(customerId).toMatch(/^customer-/);

    fireEvent.click(screen.getByRole('link', { name: '고객 정보 수정' }));
    expect(screen.getByRole('heading', { name: '고객 정보 수정' })).toBeVisible();
    fireEvent.change(screen.getByLabelText('고객 이름'), {
      target: { value: '수정된 첫 고객' },
    });
    fireEvent.change(screen.getByLabelText('고객 메모'), {
      target: { value: '수정된 메모' },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: '수정된 첫 고객' })).toBeVisible(),
    );
    expect(
      screen
        .getByTestId('customer-memo-copy')
        .closest('[data-customer-detail-page]')
        ?.getAttribute('data-selected-customer-id'),
    ).toBe(customerId);

    fireEvent.click(screen.getByRole('button', { name: '고객 목록으로 돌아가기' }));
    expect(screen.getByText('수정된 첫 고객')).toBeVisible();
    expect(screen.queryByText('첫 번째 고객')).not.toBeInTheDocument();
  });

  it('routes Schedule Customer=0 to first-customer create without changing Event empty behavior', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/app/schedule']}>
        <AppRouter initialCustomers={[]} initialEvents={[]} />
      </MemoryRouter>,
    );

    expect(screen.getByText('먼저 고객을 추가해 주세요')).toBeVisible();
    expect(screen.getByRole('link', { name: '첫 고객 추가' })).toHaveAttribute(
      'href',
      '/app/customers/new',
    );
    unmount();

    render(
      <MemoryRouter initialEntries={['/app/schedule']}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '일정' })).toBeVisible();
    expect(screen.queryByText('먼저 고객을 추가해 주세요')).not.toBeInTheDocument();
  });

  it('does not let a URL query override production customer or event seeds', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/app/customers?customerSeed=empty']}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByText('박세입')).toBeVisible();
    expect(screen.queryByText('아직 고객이 없습니다')).not.toBeInTheDocument();
    unmount();

    render(
      <MemoryRouter initialEntries={['/app/events/event-tenant-transitioned?eventSeed=empty']}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '계약 갱신 상담' })).toBeVisible();
  });
});
