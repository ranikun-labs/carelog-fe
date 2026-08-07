import { Info } from 'lucide-react';

import { useTranslation } from '@/i18n/I18nContext';

export function ComplianceNotice() {
  const { t } = useTranslation();
  return (
    <aside className="bg-muted text-text-secondary flex gap-3 rounded-lg border p-4 text-sm">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{t('compliance.message')}</p>
    </aside>
  );
}
