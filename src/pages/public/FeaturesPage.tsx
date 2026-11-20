import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  MessageSquareText,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router';

import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { buildAppHomePath } from '@/constants/routes';
import { getMessages } from '@/i18n/dictionary';
import { useTranslation } from '@/i18n/I18nContext';
import { useAppLocale } from '@/i18n/AppLocaleProvider';

const icons = [UsersRound, MessageSquareText, ClipboardList, CalendarDays];

export function FeaturesPage() {
  const { locale, t } = useTranslation();
  const { adoptPublicLocale } = useAppLocale();
  const { items, details } = getMessages(locale).public.features;
  return (
    <main className="mx-auto max-w-5xl px-5 py-16 sm:py-24">
      <p className="text-accent-primary-deep text-sm font-semibold">Carelog</p>
      <h1 className="mt-4 max-w-3xl text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
        {t('public.features.title')}
      </h1>
      <p className="text-text-secondary mt-5 max-w-2xl text-lg leading-relaxed">
        {t('public.features.description')}
      </p>
      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {items.map((item, index) => {
          const Icon = icons[index];
          return (
            <Card key={item}>
              <CardContent className="p-6 sm:p-8">
                <div className="bg-accent-primary-bg text-accent-primary-deep flex size-12 items-center justify-center rounded-xl">
                  <Icon aria-hidden="true" className="size-6" />
                </div>
                <h2 className="mt-6 text-xl font-semibold">{item}</h2>
                <p className="text-text-secondary mt-3 leading-relaxed">{details[index]}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="bg-subtle mt-12 rounded-2xl p-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-10">
        <div>
          <h2 className="text-2xl font-bold">{t('public.features.closingTitle')}</h2>
          <p className="text-text-secondary mt-3">{t('public.features.closingDescription')}</p>
        </div>
        <Link
          className={buttonVariants({ className: 'mt-6 sm:mt-0', size: 'lg' })}
          to={buildAppHomePath()}
          onClick={() => adoptPublicLocale(locale)}
        >
          {t('common.openApp')} <ArrowRight aria-hidden="true" />
        </Link>
      </div>
    </main>
  );
}
