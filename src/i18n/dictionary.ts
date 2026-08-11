import type { Locale } from '@/constants/routes';
import { en } from '@/i18n/messages/en';
import { ko } from '@/i18n/messages/ko';

export interface Messages {
  common: {
    appName: string;
    openApp: string;
    learnMore: string;
    changeLanguage: string;
  };
  navigation: {
    home: string;
    features: string;
    today: string;
    schedule: string;
    customers: string;
    followUps: string;
    ariaLabel: string;
  };
  public: {
    home: { eyebrow: string; title: string; description: string };
    features: {
      title: string;
      description: string;
      items: readonly [string, string, string, string];
    };
  };
  app: {
    home: { eyebrow: string; title: string; description: string; customersAction: string };
  };
  customers: {
    title: string;
    description: string;
    back: string;
    recentContact: string;
    detail: {
      title: string;
      contextTitle: string;
      contextUpdatedAt: string;
      addEvent: string;
      upcomingTitle: string;
      noUpcoming: string;
      additionalUpcoming: string;
      memoTitle: string;
    };
    import: { title: string };
    handoff: { title: string };
  };
  reviews: {
    detail: { title: string };
  };
  followUps: {
    title: string;
    description: string;
  };
  schedule: {
    eyebrow: string;
    title: string;
    description: string;
    weekStripLabel: string;
    today: string;
    hasEvents: string;
    overdueCueLabel: string;
    overdueBadge: string;
    overdueMeta: string;
    todayReturn: string;
    emptyTitle: string;
    emptyDescription: string;
    emptyCustomersAction: string;
    loadingLabel: string;
    errorTitle: string;
    errorDescription: string;
    retry: string;
    noEventsDate: string;
    untitled: string;
    openEvent: string;
    unknownCustomer: string;
    meta: {
      planned: string;
      overdue: string;
      occurred: string;
      cancelled: string;
    };
  };
  eventDetail: {
    back: string;
    customer: string;
    statusPlanned: string;
    statusCancelled: string;
    edit: string;
    cancel: string;
    markOccurred: string;
    scheduledTime: string;
    actualTime: string;
    time: string;
    memo: string;
  };
  eventForm: {
    createTitle: string;
    editTitle: string;
    customer: string;
    kindLabel: string;
    planned: string;
    immediateOccurred: string;
    descriptor: string;
    descriptorPlaceholder: string;
    scheduledTime: string;
    occurredTime: string;
    originalScheduledPreserved: string;
    note: string;
    notePlaceholder: string;
    scheduledRequired: string;
    occurredRequired: string;
    cancel: string;
    create: string;
    save: string;
  };
  timeline: {
    title: string;
    empty: string;
    loadMore: string;
  };
  placeholder: {
    comingSoon: string;
  };
  settings: {
    title: string;
    description: string;
    currentLanguage: string;
    korean: string;
    english: string;
  };
  notFound: {
    title: string;
    description: string;
    action: string;
  };
}

type DotPaths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${DotPaths<T[K]>}`;
}[keyof T & string];

export type MessageKey = DotPaths<Messages>;
export const MESSAGES: Record<Locale, Messages> = { ko, en };

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}
