import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { AppShell } from '@/components/layout/AppShell';

describe('AppShell', () => {
  it('keeps the adaptive host full width and lets it own the single-column frame', () => {
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
    const adaptiveHost = content.closest('[data-adaptive-host]');

    expect(appHost).toHaveClass('w-full', 'bg-page');
    expect(appContent).toHaveClass('flex-1', 'bg-surface');
    expect(adaptiveHost).toHaveAttribute('data-adaptive-mode', 'single');
    expect(appHost).not.toBe(appContent);
  });
});
