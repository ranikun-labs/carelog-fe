import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { AppShell } from '@/components/layout/AppShell';

describe('AppShell', () => {
  it('separates the full-width adaptive host from the legacy-width product content', () => {
    render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route path="/app" element={<AppShell />}>
            <Route index element={<main>Customer foundation</main>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const content = screen.getByText('Customer foundation');
    const appContent = content.closest('[data-app-content]');
    const appHost = content.closest('[data-app-host]');

    expect(appHost).toHaveClass('w-full', 'bg-page');
    expect(appContent).toHaveClass('max-w-[var(--carelog-legacy-content-max)]', 'bg-surface');
    expect(appHost).not.toBe(appContent);
  });
});
