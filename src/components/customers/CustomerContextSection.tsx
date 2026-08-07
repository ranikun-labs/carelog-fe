import type { CustomerContext } from '@/types/customer';
import { useTranslation } from '@/i18n/I18nContext';
import { formatDate } from '@/lib/utils';

interface CustomerContextSectionProps {
  context: CustomerContext;
}

export function CustomerContextSection({ context }: CustomerContextSectionProps) {
  const { t } = useTranslation();
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">{t('customers.detail.contextTitle')}</h2>
      <p className="text-text-secondary mt-1">{context.summary}</p>
      <p className="text-text-tertiary mt-1 text-sm">
        {t('customers.detail.contextUpdatedAt')}:{' '}
        <time dateTime={context.updatedAt}>{formatDate(context.updatedAt)}</time>
      </p>
    </section>
  );
}
