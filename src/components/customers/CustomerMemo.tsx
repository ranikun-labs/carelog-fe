import { useTranslation } from '@/i18n/I18nContext';

interface CustomerMemoProps {
  memo?: string;
}

export function CustomerMemo({ memo }: CustomerMemoProps) {
  const { t } = useTranslation();
  const normalizedMemo = memo?.trim();
  if (!normalizedMemo) return null;

  return (
    <section className="mt-8" data-customer-memo aria-labelledby="customer-memo-title">
      <h2 id="customer-memo-title" className="type-section-title text-foreground break-keep">
        {t('customers.detail.memoTitle')}
      </h2>
      <p
        data-testid="customer-memo-copy"
        className="type-reading text-text-body bg-inset rounded-inset mt-2 line-clamp-3 p-4 wrap-anywhere break-keep"
      >
        {normalizedMemo}
      </p>
    </section>
  );
}
