import type { CustomerContext } from '@/types/customer';
import { useTranslation } from '@/i18n/I18nContext';
import { formatDate } from '@/lib/utils';

interface CustomerContextSectionProps {
  context?: CustomerContext;
}

export function CustomerContextSection({ context }: CustomerContextSectionProps) {
  const { t } = useTranslation();
  if (!context) return null;

  return (
    <section className="mt-4">
      <h2 className="text-text-primary text-base font-bold">
        {t('customers.detail.contextTitle')}
      </h2>
      <p className="text-text-secondary mt-2 leading-relaxed break-words">{context.summary}</p>
      <p className="text-text-tertiary mt-1 text-sm">
        {t('customers.detail.contextUpdatedAt')}:{' '}
        <time dateTime={context.updatedAt}>{formatDate(context.updatedAt)}</time>
      </p>
    </section>
  );
}
