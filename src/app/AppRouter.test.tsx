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
    expect(await screen.findByRole('heading', { name: /React 기반/ })).toBeInTheDocument();
  });

  it('renders English and unsupported public locale boundaries', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/en/features']}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: 'A verifiable product foundation' })).toBeVisible();
    unmount();
    render(
      <MemoryRouter initialEntries={['/fr']}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '페이지를 찾을 수 없습니다' })).toBeVisible();
  });

  it('marks Items active on an encoded detail route', () => {
    render(
      <MemoryRouter initialEntries={['/app/items/folder%2Fitem%201']}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByText('folder/item 1')).toBeVisible();
    expect(screen.getByRole('link', { name: '항목' })).toHaveAttribute('aria-current', 'page');
  });

  it('renders an encoded unicode item id without double decoding', () => {
    render(
      <MemoryRouter initialEntries={[`/app/items/${encodeURIComponent('한글 항목')}`]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByText('한글 항목')).toBeVisible();
  });
});
