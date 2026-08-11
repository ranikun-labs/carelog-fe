import { Link, useLocation } from 'react-router';

import { BOTTOM_TABS } from '@/constants/navigation';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';

export function BottomNavigation() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  return (
    <nav
      aria-label={t('navigation.ariaLabel')}
      className="bg-background border-t pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-3">
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
    </nav>
  );
}
