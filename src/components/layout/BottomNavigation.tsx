import { Link, useLocation } from 'react-router';
import { UserRound } from 'lucide-react';

import { BOTTOM_TABS } from '@/constants/navigation';
import { buildAppSettingsPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';

/**
 * 폰(<768) 하단 내비. 탭 2개 + 계정 진입 줄 구조(제품 결정)는 그대로 둔다.
 * 활성 표시는 색 외 단서(아이콘 면 + 굵은 선)를 함께 쓴다(WCAG 1.4.1). 포커스는 전역 규칙.
 * 하단 safe-area는 이 컴포넌트가, 상·좌우는 AppShell 프레임이 맡는다.
 */
export function BottomNavigation() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const accountActive = pathname.startsWith(buildAppSettingsPath());
  return (
    <nav
      aria-label={t('navigation.ariaLabel')}
      data-bottom-navigation
      className="bg-surface border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-2">
        {BOTTOM_TABS.map((tab) => {
          const active = tab.match(pathname);
          const Icon = tab.icon;
          return (
            <li key={tab.id}>
              <Link
                to={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'type-label flex min-h-14 flex-col items-center justify-center gap-0.5',
                  active ? 'text-brand-deep' : 'text-text-secondary',
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'rounded-badge flex h-7 w-12 items-center justify-center',
                    active && 'bg-brand-subtle',
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.5 : 2} />
                </span>
                <span>{t(tab.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        to={buildAppSettingsPath()}
        aria-current={accountActive ? 'page' : undefined}
        className={cn(
          'type-supporting flex min-h-11 items-center justify-center gap-2 border-t px-4 py-2 font-semibold',
          accountActive ? 'text-brand-deep' : 'text-text-secondary',
        )}
      >
        <UserRound className="size-4" aria-hidden="true" strokeWidth={accountActive ? 2.5 : 2} />
        {t('auth.account.entry')}
      </Link>
    </nav>
  );
}
