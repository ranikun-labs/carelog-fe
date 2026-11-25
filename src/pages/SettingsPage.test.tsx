import { fireEvent, render, screen } from '@testing-library/react';

import { SettingsPage } from '@/pages/SettingsPage';
import { AppLocaleProvider } from '@/i18n/AppLocaleProvider';
import { ThemeProvider } from '@/theme/ThemeProvider';

vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ logout: vi.fn() }) }));

describe('SettingsPage language choice (M6)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('offers the languages as a native radio group with no Strong selection', () => {
    render(
      <AppLocaleProvider syncDocumentLang={false}>
        <ThemeProvider>
          <SettingsPage />
        </ThemeProvider>
      </AppLocaleProvider>,
    );
    expect(screen.getByRole('group', { name: '현재 언어' })).toBeInstanceOf(HTMLFieldSetElement);
    const radios = screen.getAllByRole('radio').slice(0, 2);
    expect(radios).toHaveLength(2);
    const [ko, en] = radios as HTMLInputElement[];
    expect(ko.checked).toBe(true);
    // 선택 표시는 brand-subtle 면 + 체크이며 진한(primary) 면이 아니다.
    const koRow = ko.closest('label')!;
    expect(koRow.className).toContain('bg-brand-subtle');
    expect(koRow.className).not.toContain('bg-primary');
    expect(koRow.querySelector('svg')).not.toBeNull();
    expect(en.closest('label')!.querySelector('svg')).toBeNull();

    fireEvent.click(en);
    expect(en.checked).toBe(true);
    expect(screen.getByText(/EN$/)).toBeInTheDocument();
  });
});
