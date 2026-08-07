import type { Messages } from '@/i18n/dictionary';

export const en: Messages = {
  common: {
    appName: 'Carelog',
    openApp: 'Open app',
    learnMore: 'View features',
    changeLanguage: 'Change language',
  },
  navigation: {
    home: 'Home',
    features: 'Features',
    today: 'Today',
    customers: 'Customers',
    followUps: 'Follow-ups',
    ariaLabel: 'Primary navigation',
  },
  public: {
    home: {
      eyebrow: 'Customer Relationship Foundation',
      title: 'Customer context and follow-ups, in one place',
      description: 'Start with localized public pages and a mobile-first application shell.',
    },
    features: {
      title: 'A verifiable customer management foundation',
      description: 'Common boundaries are ready to extend into real customer workflows.',
      items: ['Localized routes', 'App shell', 'Reusable components', 'Verification foundation'],
    },
  },
  app: {
    home: {
      eyebrow: 'Today',
      title: 'Welcome to Carelog',
      description: 'No customer data is connected here yet.',
      customersAction: 'View customers',
    },
  },
  customers: {
    title: 'Customers',
    description: 'A placeholder for checking the customer list and detail routes.',
    back: 'Back to customers',
    detail: { title: 'Customer detail' },
    import: { title: 'Import customers' },
    handoff: { title: 'Handoff' },
  },
  reviews: {
    detail: { title: 'Review' },
  },
  followUps: {
    title: 'Follow-ups',
    description: 'A placeholder for checking upcoming follow-up work.',
  },
  placeholder: {
    comingSoon: 'This screen will be filled in during a later step.',
  },
  settings: {
    title: 'Settings',
    description: 'The app language is stored on this device.',
    currentLanguage: 'Current language',
    korean: '한국어',
    english: 'English',
  },
  notFound: {
    title: 'Page not found',
    description: 'The requested path is not part of this app.',
    action: 'Go home',
  },
};
