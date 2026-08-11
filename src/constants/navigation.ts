import { CalendarDays, Users, type LucideIcon } from 'lucide-react';

import { buildAppCustomersPath, buildAppHomePath, buildAppSchedulePath } from '@/constants/routes';
import type { MessageKey } from '@/i18n/dictionary';

export interface BottomTab {
  id: 'schedule' | 'customers';
  href: string;
  labelKey: MessageKey;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
}

export const BOTTOM_TABS: readonly BottomTab[] = [
  {
    id: 'schedule',
    href: buildAppSchedulePath(),
    labelKey: 'navigation.schedule',
    icon: CalendarDays,
    match: (pathname) =>
      pathname === buildAppHomePath() || pathname.startsWith(buildAppSchedulePath()),
  },
  {
    id: 'customers',
    href: buildAppCustomersPath(),
    labelKey: 'navigation.customers',
    icon: Users,
    match: (pathname) => pathname.startsWith(buildAppCustomersPath()),
  },
] as const;
