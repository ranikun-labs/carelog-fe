import { Link, useLocation } from 'react-router';
import { UserRound } from 'lucide-react';

import { BOTTOM_TABS } from '@/constants/navigation';
import { buildAppSettingsPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';

export function BottomNavigation() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('navigation.ariaLabel')}
      data-bottom-navigation
      className="bg-background border-t pb-[env(safe-area-inset-bottom)] md:hidden"
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
                  'flex min-h-14 flex-col items-center justify-center gap-1 text-xs',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                <span>{t(tab.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <Link
        to={buildAppSettingsPath()}
        aria-current={pathname.startsWith(buildAppSettingsPath()) ? 'page' : undefined}
        className={cn(
          'text-text-secondary flex min-h-11 items-center justify-center gap-2 border-t px-4 py-2 text-sm font-semibold',
          pathname.startsWith(buildAppSettingsPath()) && 'text-primary',
        )}
      >
        <UserRound className="size-4" aria-hidden="true" />
        {t('auth.account.entry')}
      </Link>
    </nav>
  );
}
