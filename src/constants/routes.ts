export const SUPPORTED_LOCALES = ['ko', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ko';

export function isSupportedLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export const PUBLIC_ROUTE_PATHS = {
  localeHome: '/:locale',
  features: '/:locale/features',
} as const;

export const APP_BASE = '/app';
export const APP_ROUTE_PATHS = {
  home: APP_BASE,
  items: `${APP_BASE}/items`,
  itemDetail: `${APP_BASE}/items/:id`,
  settings: `${APP_BASE}/settings`,
} as const;

export const buildPublicHomePath = (locale: Locale) => `/${locale}`;
export const buildPublicFeaturesPath = (locale: Locale) => `/${locale}/features`;
export const buildAppHomePath = () => APP_ROUTE_PATHS.home;
export const buildAppItemsPath = () => APP_ROUTE_PATHS.items;
export const buildAppItemDetailPath = (id: string) =>
  `${APP_ROUTE_PATHS.items}/${encodeURIComponent(id)}`;
export const buildAppSettingsPath = () => APP_ROUTE_PATHS.settings;

export function toRelativeUnder(base: string, path: string): string {
  return path.slice(base.length).replace(/^\//, '');
}
