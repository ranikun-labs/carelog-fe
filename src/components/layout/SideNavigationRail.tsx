import { Link, useLocation } from 'react-router';

import { BOTTOM_TABS } from '@/constants/navigation';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';

export function SideNavigationRail() {
  const { pathname } = useLocation();
  const { t } = useTranslation();

  return (
    <aside data-side-navigation className="bg-surface hidden w-20 shrink-0 border-r md:block">
      <nav aria-label={t('navigation.ariaLabel')} className="h-full px-2 py-4">
        <ul className="flex flex-col gap-2">
          {BOTTOM_TABS.map((tab) => {
            const active = tab.match(pathname);
            const Icon = tab.icon;
            return (
              <li key={tab.id}>
                <Link
                  to={tab.href}
                  aria-current={active ? 'page' : undefined}
                  style={{ outlineColor: 'var(--accent-primary)' }}
                  className={cn(
                    'text-text-secondary flex min-h-14 flex-col items-center justify-center gap-1 rounded-md px-1 text-center text-[0.6875rem] font-semibold transition-colors',
                    active ? 'bg-accent-primary-bg text-accent-primary-deep' : 'hover:bg-subtle',
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  <span className="max-w-full truncate">{t(tab.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
