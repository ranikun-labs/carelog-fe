import { act, fireEvent, render, screen } from '@testing-library/react';

import { AppLocaleProvider } from '@/i18n/AppLocaleProvider';
import { SettingsPage } from '@/pages/SettingsPage';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { THEME_STORAGE_KEY } from '@/theme/themePreference';

vi.mock('@/auth/AuthProvider', () => ({ useAuth: () => ({ logout: vi.fn() }) }));

type Listener = (event: { matches: boolean }) => void;
let listeners: Listener[] = [];
let systemDark = false;

beforeEach(() => {
  listeners = [];
  systemDark = false;
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => ({
      get matches() {
        return systemDark;
      },
      addEventListener: (_: string, l: Listener) => listeners.push(l),
      removeEventListener: (_: string, l: Listener) => {
        listeners = listeners.filter((x) => x !== l);
      },
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
  document.documentElement.classList.remove('dark');
});

function renderSettings() {
  return render(
    <AppLocaleProvider syncDocumentLang={false}>
      <ThemeProvider>
        <SettingsPage />
      </ThemeProvider>
    </AppLocaleProvider>,
  );
}

const isDark = () => document.documentElement.classList.contains('dark');

describe('ThemeProvider + SettingsPage display mode', () => {
  it('defaults to following the system and reacts to system changes live', () => {
    renderSettings();
    const system = screen.getByRole('radio', { name: '시스템 설정 따르기' }) as HTMLInputElement;
    expect(system.checked).toBe(true);
    expect(isDark()).toBe(false);
    act(() => {
      systemDark = true;
      listeners.forEach((l) => l({ matches: true }));
    });
    expect(isDark()).toBe(true);
  });

  it('stores only locally and ignores the system once an explicit choice is made', () => {
    renderSettings();
    fireEvent.click(screen.getByRole('radio', { name: '라이트' }));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    act(() => {
      systemDark = true;
      listeners.forEach((l) => l({ matches: true }));
    });
    expect(isDark()).toBe(false);
    fireEvent.click(screen.getByRole('radio', { name: '다크' }));
    expect(isDark()).toBe(true);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    fireEvent.click(screen.getByRole('radio', { name: '시스템 설정 따르기' }));
    expect(isDark()).toBe(true); // 시스템이 다크
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
  });

  it('restores the stored choice and keeps the screen working when storage fails', () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    renderSettings();
    expect((screen.getByRole('radio', { name: '다크' }) as HTMLInputElement).checked).toBe(true);
    expect(isDark()).toBe(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    fireEvent.click(screen.getByRole('radio', { name: '라이트' }));
    expect(isDark()).toBe(false);
    vi.restoreAllMocks();
  });

  it('describes only what happens (device-local storage, no account sync claim)', () => {
    renderSettings();
    expect(screen.getByText('앱 언어와 화면 모드는 이 기기에 저장됩니다.')).toBeInTheDocument();
  });
});
