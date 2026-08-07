import { CalendarCheck } from 'lucide-react';

import { EmptyState } from '@/components/common/EmptyState';
import { useTranslation } from '@/i18n/I18nContext';

export function FollowUpsPage() {
  const { t } = useTranslation();
  return (
    <main className="p-6 pt-10">
      <h1 className="text-3xl font-bold">{t('followUps.title')}</h1>
      <p className="text-text-secondary mt-2">{t('followUps.description')}</p>
      <EmptyState
        icon={<CalendarCheck className="size-8" aria-hidden="true" />}
        title={t('followUps.title')}
        description={t('placeholder.comingSoon')}
      />
    </main>
  );
}
