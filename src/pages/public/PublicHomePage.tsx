import { Link } from 'react-router';

import { buttonVariants } from '@/components/ui/button';
import { buildAppHomePath, buildPublicFeaturesPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';

export function PublicHomePage() {
  const { locale, t } = useTranslation();
  return (
    <main className="mx-auto flex max-w-5xl flex-col items-start gap-6 px-5 py-24">
      <p className="text-primary font-medium">{t('public.home.eyebrow')}</p>
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
        {t('public.home.title')}
      </h1>
      <p className="text-text-secondary max-w-2xl text-lg">{t('public.home.description')}</p>
      <div className="flex gap-3">
        <Link className={buttonVariants()} to={buildAppHomePath()}>
          {t('common.openApp')}
        </Link>
        <Link
          className={buttonVariants({ variant: 'outline' })}
          to={buildPublicFeaturesPath(locale)}
        >
          {t('common.learnMore')}
        </Link>
      </div>
    </main>
  );
}
