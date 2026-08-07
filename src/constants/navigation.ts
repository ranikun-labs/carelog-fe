import { Home, ListChecks, Settings, type LucideIcon } from 'lucide-react';

import { buildAppHomePath, buildAppItemsPath, buildAppSettingsPath } from '@/constants/routes';
import type { MessageKey } from '@/i18n/dictionary';

export interface BottomTab {
  id: 'home' | 'items' | 'settings';
  href: string;
  labelKey: MessageKey;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
}

export const BOTTOM_TABS: readonly BottomTab[] = [
  {
    id: 'home',
    href: buildAppHomePath(),
    labelKey: 'navigation.home',
    icon: Home,
    match: (pathname) => pathname === buildAppHomePath(),
  },
  {
    id: 'items',
    href: buildAppItemsPath(),
    labelKey: 'navigation.items',
    icon: ListChecks,
    match: (pathname) => pathname.startsWith(buildAppItemsPath()),
  },
  {
    id: 'settings',
    href: buildAppSettingsPath(),
    labelKey: 'navigation.settings',
    icon: Settings,
    match: (pathname) => pathname.startsWith(buildAppSettingsPath()),
  },
] as const;
