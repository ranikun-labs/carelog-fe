import { Link } from 'react-router';

import { useAuth } from '@/auth/AuthProvider';
import { buttonVariants } from '@/components/ui/button';
import { buildAuthLoginPath, buildAuthSignupPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';

export function AuthEntryPage() {
  const { t } = useTranslation();
  const { signupAvailable } = useAuth();
  return (
    <section data-auth-entry className="grid gap-8">
      <div className="grid gap-3">
        <p className="text-accent-primary text-sm font-semibold tracking-wide">
          {t('auth.entry.eyebrow')}
        </p>
        <h1 className="text-text-primary text-3xl font-bold tracking-tight sm:text-4xl">
          {t('auth.entry.title')}
        </h1>
        <p className="text-text-secondary leading-7">{t('auth.entry.description')}</p>
      </div>
      <div className="grid gap-3">
        <Link className={cn(buttonVariants({ size: 'lg' }), 'w-full')} to={buildAuthLoginPath()}>
          {t('auth.entry.login')}
        </Link>
        {signupAvailable ? (
          <Link
            className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'w-full')}
            to={buildAuthSignupPath()}
          >
            {t('auth.entry.signup')}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
