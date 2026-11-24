import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { PageHeader } from '@/components/common/PageHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { SideNavigationRail } from '@/components/layout/SideNavigationRail';
import { I18nProvider } from '@/i18n/I18nContext';

function renderAt(path: string, ui: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <I18nProvider locale="ko">{ui}</I18nProvider>
    </MemoryRouter>,
  );
}

describe.each([
  ['BottomNavigation', '[data-bottom-navigation]', <BottomNavigation key="b" />],
  ['SideNavigationRail', '[data-side-navigation]', <SideNavigationRail key="s" />],
])('%s', (_name, hook, element) => {
  it('keeps the e2e hook and marks only the current destination', () => {
    const { container } = renderAt('/app/customers', element);
    expect(container.querySelector(hook)).not.toBeNull();
    const current = screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current'));
    expect(current.map((l) => l.textContent)).toEqual(['고객']);
  });

  it('marks the account entry as current on settings', () => {
    renderAt('/app/settings', element);
    const current = screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current'));
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAttribute('href', '/app/settings');
  });

  it('has no 11px labels, no inline focus override, and uses the inset (not subtle) hover surface', () => {
    const { container } = renderAt('/app/schedule', element);
    const html = container.innerHTML;
    expect(html).not.toMatch(/text-\[0\.6875rem\]|text-xs|text-\[11px\]/);
    expect(html).not.toContain('outline-color');
    expect(html).not.toContain('bg-subtle');
    // transition-colors would animate outline-color and make the focus ring read mid-transition.
    expect(html).not.toContain('transition-colors');
    for (const link of screen.getAllByRole('link')) {
      expect(link.className).toMatch(/min-h-1[14]|min-h-14/);
    }
  });
});

describe('SideNavigationRail width contract', () => {
  it('stays 80px (w-20): it defines the AdaptiveHost availableWidth threshold (1180 viewport = 1100 available)', () => {
    const { container } = renderAt('/app', <SideNavigationRail />);
    expect(container.querySelector('[data-side-navigation]')).toHaveClass('w-20');
  });
});

describe('PageHeader', () => {
  it('renders a 44px neutral icon back button and the page-title role', () => {
    const onBack = vi.fn();
    render(<PageHeader title="제목" backLabel="뒤로" onBack={onBack} />);
    const back = screen.getByRole('button', { name: '뒤로' });
    expect(back).toHaveClass('size-11');
    expect(back.querySelector('svg')).not.toBeNull();
    expect(back).not.toHaveTextContent('←');
    expect(screen.getByRole('heading', { level: 1, name: '제목' })).toHaveClass('type-page-title');
    back.click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('omits the back button without onBack', () => {
    render(<PageHeader title="제목" backLabel="뒤로" />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
