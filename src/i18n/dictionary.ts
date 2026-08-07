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
    items: string;
    settings: string;
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
    home: { eyebrow: string; title: string; description: string; itemsAction: string };
  };
  items: {
    title: string;
    description: string;
    sampleNames: readonly [string, string, string];
    detail: {
      title: string;
      identifier: string;
      created: string;
      checklist: string;
      steps: readonly [string, string, string];
      back: string;
    };
  };
  settings: {
    title: string;
    description: string;
    currentLanguage: string;
    korean: string;
    english: string;
  };
  compliance: {
    message: string;
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
