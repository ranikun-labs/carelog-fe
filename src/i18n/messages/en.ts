import type { Messages } from '@/i18n/dictionary';

export const en: Messages = {
  common: {
    appName: 'React Product Foundation',
    openApp: 'Open app',
    learnMore: 'View features',
    changeLanguage: 'Change language',
  },
  navigation: {
    home: 'Home',
    features: 'Features',
    items: 'Items',
    settings: 'Settings',
    ariaLabel: 'Primary navigation',
  },
  public: {
    home: {
      eyebrow: 'Minimal Foundation',
      title: 'A solid React foundation for your next product',
      description: 'Start with localized public pages and a mobile-first application shell.',
    },
    features: {
      title: 'A verifiable product foundation',
      description: 'Common boundaries are ready to replace with real product requirements.',
      items: ['Localized routes', 'App shell', 'Reusable components', 'Verification foundation'],
    },
  },
  app: {
    home: {
      eyebrow: 'Starter App',
      title: 'Welcome to your new product',
      description: 'No personalization or external API is connected here.',
      itemsAction: 'View sample items',
    },
  },
  items: {
    title: 'Items',
    description: 'Neutral examples for checking list and detail routes.',
    sampleNames: ['Sample workspace', 'Check checklist', 'Starter task'],
    detail: {
      title: 'Item detail',
      identifier: 'Identifier',
      created: 'Created',
      checklist: 'Starter checklist',
      steps: ['Replace product copy', 'Check routes', 'Run verification commands'],
      back: 'Back to items',
    },
  },
  settings: {
    title: 'Settings',
    description: 'The app language is stored on this device.',
    currentLanguage: 'Current language',
    korean: '한국어',
    english: 'English',
  },
  compliance: {
    message: 'This screen contains examples that must be replaced with your product policy.',
  },
  notFound: {
    title: 'Page not found',
    description: 'The requested path is not part of this starter.',
    action: 'Go home',
  },
};
