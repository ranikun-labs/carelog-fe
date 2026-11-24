import { Link } from 'react-router';

import { buildAppCustomerDetailPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';
import { cn, formatDate } from '@/lib/utils';
import type { CustomerRecord } from '@/types/customer';

interface CustomerCardProps {
  customer: CustomerRecord;
  isSelected?: boolean;
  onSelect?: () => void;
}

/**
 * 목록 한 행. 구분선은 CustomersPage의 목록(divide-y)이 맡고, 행 자체는 카드 면·테두리·그림자가 없다.
 * 선택 행은 brand-subtle 면 + 굵은 이름 + aria-current(색 외 단서), 면 위 글자는 brand-deep.
 * 이름은 한글 어절 단위로 줄바꿈하되 긴 무공백 이름은 넘치지 않게 끊는다.
 */
export function CustomerCard({ customer, isSelected = false, onSelect }: CustomerCardProps) {
  const { t } = useTranslation();
  return (
    <div data-customer-card data-customer-id={customer.id} className="rounded-control">
      <Link
        className={cn(
          'rounded-control flex min-h-11 min-w-0 flex-col gap-1 px-4 py-3 transition-colors xl:flex-row xl:items-center xl:gap-4',
          isSelected ? 'bg-brand-subtle text-brand-deep' : 'text-text-secondary hover:bg-inset',
        )}
        to={buildAppCustomerDetailPath(customer.id)}
        aria-current={isSelected ? 'true' : undefined}
        onClick={(event) => {
          if (!onSelect) return;
          event.preventDefault();
          onSelect();
        }}
      >
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 xl:flex-1">
          <span
            className={cn(
              'type-content-title wrap-anywhere break-keep',
              // 선택 행은 600 → 700으로 굵게 해 색 외 단서를 준다(WCAG 1.4.1).
              isSelected ? 'text-brand-deep font-bold' : 'text-foreground',
            )}
          >
            {customer.displayName}
          </span>
          {customer.workspace?.name ? (
            <span className="type-supporting wrap-anywhere break-keep">
              {customer.workspace.name}
            </span>
          ) : null}
        </div>
        {customer.interaction ? (
          <p className="type-supporting shrink-0 break-keep xl:whitespace-nowrap">
            {t('customers.recentContact')}:{' '}
            <time dateTime={customer.interaction.occurredAt}>
              {formatDate(customer.interaction.occurredAt)}
            </time>
          </p>
        ) : null}
        {customer.context?.summary ? (
          <p className="type-supporting line-clamp-1 min-w-0 break-keep xl:flex-1">
            {customer.context.summary}
          </p>
        ) : null}
      </Link>
    </div>
  );
}
