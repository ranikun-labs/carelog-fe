import { CalendarCheck } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { useTranslation } from '@/i18n/I18nContext';

export function FollowUpsPage() {
  const { t } = useTranslation();
  return (
    <main className="p-5 pt-10">
      <h1 className="type-page-title text-foreground">{t('followUps.title')}</h1>
      <p className="type-reading text-text-secondary mt-2">{t('followUps.description')}</p>
      <EmptyState
        icon={<CalendarCheck className="size-8" aria-hidden="true" />}
        title={t('followUps.title')}
        description={t('placeholder.comingSoon')}
      />
    </main>
  );
}
