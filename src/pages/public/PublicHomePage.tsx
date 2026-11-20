import { ArrowRight, CalendarDays, MessageSquareText } from 'lucide-react';
import { Link } from 'react-router';

import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { buildAppHomePath, buildPublicFeaturesPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';
import { useAppLocale } from '@/i18n/AppLocaleProvider';
import { isCurrentTabActivation } from '@/pages/public/publicAppNavigation';

export function PublicHomePage() {
  const { locale, t } = useTranslation();
  const { adoptPublicLocale } = useAppLocale();
  return (
    <main>
      <section className="mx-auto grid max-w-5xl items-center gap-12 px-5 py-16 sm:py-24 lg:grid-cols-2 lg:gap-16">
        <div className="flex flex-col items-start gap-6">
          <p className="text-accent-primary-deep bg-accent-primary-bg rounded-full px-3 py-1 text-sm font-semibold">
            {t('public.home.eyebrow')}
          </p>
          <h1 className="text-4xl leading-tight font-bold tracking-tight sm:text-5xl">
            {t('public.home.title')}
          </h1>
          <p className="text-text-secondary max-w-xl text-lg leading-relaxed">
            {t('public.home.description')}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              className={buttonVariants({ size: 'lg' })}
              to={buildAppHomePath()}
              onClick={(event) => {
                if (isCurrentTabActivation(event)) adoptPublicLocale(locale);
              }}
            >
              {t('common.openApp')} <ArrowRight aria-hidden="true" />
            </Link>
            <Link
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
              to={buildPublicFeaturesPath(locale)}
            >
              {t('common.learnMore')}
            </Link>
          </div>
        </div>
        <div className="bg-accent-primary-bg rounded-3xl p-5 sm:p-8">
          <p className="text-accent-primary-deep mb-3 text-xs font-semibold tracking-wide">
            {t('public.home.example')}
          </p>
          <Card className="overflow-hidden shadow-sm">
            <div className="border-border-subtle border-b p-5">
              <p className="text-text-tertiary text-xs font-semibold">
                {t('public.home.exampleCustomer')}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span className="bg-accent-primary-bg text-accent-primary-deep flex size-11 items-center justify-center rounded-full font-bold">
                  C
                </span>
                <div>
                  <div className="font-semibold">Carelog</div>
                </div>
              </div>
            </div>
            <div className="space-y-5 p-5">
              <div className="flex gap-3">
                <MessageSquareText
                  aria-hidden="true"
                  className="text-accent-primary-deep mt-0.5 size-5 shrink-0"
                />
                <div>
                  <p className="text-text-tertiary text-xs">{t('public.home.exampleNote')}</p>
                  <p className="mt-1 text-sm font-medium">{t('public.home.exampleNoteText')}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <CalendarDays
                  aria-hidden="true"
                  className="text-accent-primary-deep mt-0.5 size-5 shrink-0"
                />
                <div>
                  <p className="text-text-tertiary text-xs">{t('public.home.exampleNext')}</p>
                  <p className="mt-1 text-sm font-medium">{t('public.home.exampleAction')}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>
      <section className="bg-subtle">
        <div className="mx-auto max-w-5xl px-5 py-14 sm:py-20">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {t('public.home.sectionTitle')}
          </h2>
          <p className="text-text-secondary mt-4 max-w-2xl leading-relaxed">
            {t('public.home.sectionDescription')}
          </p>
          <Link
            className="text-accent-primary-deep mt-6 inline-flex items-center gap-2 font-semibold hover:underline"
            to={buildPublicFeaturesPath(locale)}
          >
            {t('common.learnMore')} <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
