import { CalendarCheck, Home, Users, type LucideIcon } from 'lucide-react';

import { buildAppCustomersPath, buildAppFollowUpsPath, buildAppHomePath } from '@/constants/routes';
import type { MessageKey } from '@/i18n/dictionary';

export interface BottomTab {
  id: 'today' | 'customers' | 'followUps';
  href: string;
  labelKey: MessageKey;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
}

export const BOTTOM_TABS: readonly BottomTab[] = [
  {
    id: 'today',
    href: buildAppHomePath(),
    labelKey: 'navigation.today',
    icon: Home,
    match: (pathname) => pathname === buildAppHomePath(),
  },
  {
    id: 'customers',
    href: buildAppCustomersPath(),
    labelKey: 'navigation.customers',
    icon: Users,
    match: (pathname) => pathname.startsWith(buildAppCustomersPath()),
  },
  {
    id: 'followUps',
    href: buildAppFollowUpsPath(),
    labelKey: 'navigation.followUps',
    icon: CalendarCheck,
    match: (pathname) => pathname.startsWith(buildAppFollowUpsPath()),
  },
] as const;
