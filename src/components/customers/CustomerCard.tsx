import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { buildAppCustomerDetailPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';
import { cn, formatDate } from '@/lib/utils';
import type { CustomerRecord } from '@/types/customer';

interface CustomerCardProps {
  customer: CustomerRecord;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function CustomerCard({ customer, isSelected = false, onSelect }: CustomerCardProps) {
  const { t } = useTranslation();
  return (
    <Card data-customer-card data-customer-id={customer.id}>
      <CardContent className="p-0">
        <Link
          className={cn(
            'flex min-w-0 flex-col gap-2 p-4 focus-visible:outline-2 xl:flex-row xl:items-center xl:gap-4',
            isSelected && 'bg-accent-primary-bg',
          )}
          to={buildAppCustomerDetailPath(customer.id)}
          aria-current={isSelected ? 'true' : undefined}
          onClick={(event) => {
            if (!onSelect) return;
            event.preventDefault();
            onSelect();
          }}
        >
          <div className="flex min-w-0 items-center gap-2 xl:flex-1">
            <span className="font-medium break-words">{customer.displayName}</span>
            {customer.workspace.name ? <Badge tone="info">{customer.workspace.name}</Badge> : null}
          </div>
          {customer.interaction ? (
            <p className="text-text-secondary shrink-0 text-sm xl:whitespace-nowrap">
              {t('customers.recentContact')}:{' '}
              <time dateTime={customer.interaction.occurredAt}>
                {formatDate(customer.interaction.occurredAt)}
              </time>
            </p>
          ) : null}
          {customer.context?.summary ? (
            <p className="text-text-secondary line-clamp-1 min-w-0 text-sm xl:flex-1">
              {customer.context.summary}
            </p>
          ) : null}
        </Link>
      </CardContent>
    </Card>
  );
}
