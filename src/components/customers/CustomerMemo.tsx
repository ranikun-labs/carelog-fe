import { useTranslation } from '@/i18n/I18nContext';

interface CustomerMemoProps {
  memo?: string;
}

export function CustomerMemo({ memo }: CustomerMemoProps) {
  const { t } = useTranslation();
  const normalizedMemo = memo?.trim();
  if (!normalizedMemo) return null;

  return (
    <section className="mt-6" data-customer-memo aria-labelledby="customer-memo-title">
      <h2 id="customer-memo-title" className="text-lg font-semibold">
        {t('customers.detail.memoTitle')}
      </h2>
      <p
        data-testid="customer-memo-copy"
        className="text-text-secondary bg-subtle border-border-subtle mt-3 line-clamp-3 rounded-lg border p-4 text-sm break-words"
      >
        {normalizedMemo}
      </p>
    </section>
  );
}
