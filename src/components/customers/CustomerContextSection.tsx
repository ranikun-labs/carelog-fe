import type { CustomerContext } from '@/types/customer';
import { useTranslation } from '@/i18n/I18nContext';
import { formatDisplayDate } from '@/components/schedule/agendaModel';

interface CustomerContextSectionProps {
  context?: CustomerContext;
}

export function CustomerContextSection({ context }: CustomerContextSectionProps) {
  const { locale, t } = useTranslation();
  if (!context) return null;

  return (
    <section className="mt-6">
      <h2 className="type-section-title text-foreground break-keep">
        {t('customers.detail.contextTitle')}
      </h2>
      <p className="type-reading text-text-body mt-2 wrap-anywhere break-keep">{context.summary}</p>
      <p className="type-supporting text-text-tertiary mt-2">
        {t('customers.detail.contextUpdatedAt')}:{' '}
        <time dateTime={context.updatedAt}>{formatDisplayDate(context.updatedAt, locale)}</time>
      </p>
    </section>
  );
}
