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
  schedule: `${APP_BASE}/schedule`,
  customers: `${APP_BASE}/customers`,
  customerCreate: `${APP_BASE}/customers/new`,
  customerDetail: `${APP_BASE}/customers/:customerId`,
  customerEdit: `${APP_BASE}/customers/:customerId/edit`,
  customerImport: `${APP_BASE}/customers/:customerId/import`,
  customerHandoff: `${APP_BASE}/customers/:customerId/handoff`,
  reviewDetail: `${APP_BASE}/reviews/:reviewId`,
  followUps: `${APP_BASE}/follow-ups`,
  settings: `${APP_BASE}/settings`,
  eventDetail: `${APP_BASE}/events/:eventId`,
} as const;

export const buildPublicHomePath = (locale: Locale) => `/${locale}`;
export const buildPublicFeaturesPath = (locale: Locale) => `/${locale}/features`;
export const buildAppHomePath = () => APP_ROUTE_PATHS.home;
export const buildAppSchedulePath = () => APP_ROUTE_PATHS.schedule;
export const buildAppCustomersPath = () => APP_ROUTE_PATHS.customers;
export const buildAppCustomerCreatePath = () => APP_ROUTE_PATHS.customerCreate;
export const buildAppCustomerDetailPath = (customerId: string) =>
  `${APP_ROUTE_PATHS.customers}/${encodeURIComponent(customerId)}`;
export const buildAppCustomerEditPath = (customerId: string) =>
  `${buildAppCustomerDetailPath(customerId)}/edit`;
export const buildAppCustomerImportPath = (customerId: string) =>
  `${buildAppCustomerDetailPath(customerId)}/import`;
export const buildAppCustomerHandoffPath = (customerId: string) =>
  `${buildAppCustomerDetailPath(customerId)}/handoff`;
export const buildAppReviewDetailPath = (reviewId: string) =>
  `${APP_BASE}/reviews/${encodeURIComponent(reviewId)}`;
export const buildAppFollowUpsPath = () => APP_ROUTE_PATHS.followUps;
export const buildAppSettingsPath = () => APP_ROUTE_PATHS.settings;
export const buildAppEventDetailPath = (eventId: string) =>
  `${APP_BASE}/events/${encodeURIComponent(eventId)}`;

export function toRelativeUnder(base: string, path: string): string {
  return path.slice(base.length).replace(/^\//, '');
}
