import { Link, useLocation } from 'react-router';
import { UserRound } from 'lucide-react';

import { BOTTOM_TABS } from '@/constants/navigation';
import { buildAppSettingsPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';

/**
 * 폰(<768) 하단 내비. 일정·고객·계정을 한 줄 3칸으로 둬 높이를 약 57px(+safe area)로 줄인다(F1-G4).
 * 계정은 BOTTOM_TABS(주요 목적지 2개)에 넣지 않고 같은 줄의 별도 칸으로만 둔다 — 계정 진입·라우트 불변.
 * 활성 표시는 색 외 단서(아이콘 면 + 굵은 선)를 함께 쓴다(WCAG 1.4.1). 포커스는 전역 규칙.
 * 칸마다 높이 56·폭 ≥106(320 기준)이라 44 터치 대상을 만족한다.
 * 하단 safe-area는 이 컴포넌트가, 상·좌우는 AppShell 프레임이 맡는다.
 */
export function BottomNavigation() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const accountActive = pathname.startsWith(buildAppSettingsPath());
  const destinations = [
    ...BOTTOM_TABS.map((tab) => ({
      id: tab.id,
      href: tab.href,
      label: t(tab.labelKey),
      Icon: tab.icon,
      active: tab.match(pathname),
    })),
    {
      id: 'account',
      href: buildAppSettingsPath(),
      label: t('auth.account.entry'),
      Icon: UserRound,
      active: accountActive,
    },
  ];
  return (
    <nav
      aria-label={t('navigation.ariaLabel')}
      data-bottom-navigation
      className="bg-surface border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-3">
        {destinations.map(({ id, href, label, Icon, active }) => (
          <li key={id}>
            <Link
              to={href}
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
              <span>{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
