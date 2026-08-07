import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { AppRouter } from '@/app/AppRouter';

describe('application router', () => {
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
    expect(screen.getByRole('link', { name: '고객' })).toHaveAttribute('aria-current', 'page');
  });

  it('resolves a known customer id on the detail route via the shared fixtures', () => {
    render(
      <MemoryRouter initialEntries={['/app/customers/customer-tenant-1']}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '박세입' })).toBeVisible();
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
});
