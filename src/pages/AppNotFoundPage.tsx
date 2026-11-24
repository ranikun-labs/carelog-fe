import { Link } from 'react-router';

import { buttonVariants } from '@/components/ui/button';
import { buildAppHomePath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';

export function AppNotFoundPage() {
  const { t } = useTranslation();
  return (
    <main className="grid h-full place-content-center gap-3 p-6 text-center">
      <h1 className="type-page-title text-foreground">{t('notFound.title')}</h1>
      <p className="type-reading text-text-secondary">{t('notFound.description')}</p>
      <Link
        className={cn(buttonVariants({ variant: 'text' }), 'justify-self-center')}
        to={buildAppHomePath()}
      >
        {t('notFound.action')}
      </Link>
    </main>
  );
}
