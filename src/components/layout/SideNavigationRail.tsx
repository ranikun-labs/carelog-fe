import { Link, useLocation } from 'react-router';
import { UserRound } from 'lucide-react';

import { BOTTOM_TABS } from '@/constants/navigation';
import { buildAppSettingsPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';

/**
 * 태블릿·가로(>=768) 좌측 레일. 폭 80px은 AdaptiveHost의 availableWidth(>=1100 가로 2단) 계약을
 * 결정하므로 바꾸지 않는다(1180 가로 = 레일 80 + 가용 1100). 라벨 12px, 활성 = brand-subtle + deep.
 * 포커스는 전역 :focus-visible 규칙만 쓴다(개별 outline 지정 없음).
 */
const railLinkClass =
  'type-label flex min-h-14 flex-col items-center justify-center gap-1 rounded-control px-1 text-center transition-colors';

export function SideNavigationRail() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const accountActive = pathname.startsWith(buildAppSettingsPath());

  return (
    <aside data-side-navigation className="bg-surface hidden w-20 shrink-0 border-r md:block">
      <nav aria-label={t('navigation.ariaLabel')} className="h-full px-2 py-4">
        <ul className="flex h-full flex-col gap-2">
          {BOTTOM_TABS.map((tab) => {
            const active = tab.match(pathname);
            const Icon = tab.icon;
            return (
              <li key={tab.id}>
                <Link
                  to={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    railLinkClass,
                    active
                      ? 'bg-brand-subtle text-brand-deep'
                      : 'text-text-secondary hover:bg-inset',
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" strokeWidth={active ? 2.5 : 2} />
                  <span className="max-w-full truncate">{t(tab.labelKey)}</span>
                </Link>
              </li>
            );
          })}
          <li className="mt-auto">
            <Link
              to={buildAppSettingsPath()}
              aria-current={accountActive ? 'page' : undefined}
              className={cn(
                railLinkClass,
                accountActive
                  ? 'bg-brand-subtle text-brand-deep'
                  : 'text-text-secondary hover:bg-inset',
              )}
            >
              <UserRound
                className="size-5"
                aria-hidden="true"
                strokeWidth={accountActive ? 2.5 : 2}
              />
              <span className="max-w-full truncate">{t('auth.account.entry')}</span>
            </Link>
          </li>
        </ul>
      </nav>
    </aside>
  );
}
