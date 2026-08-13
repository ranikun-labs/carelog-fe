import { useEffect, useLayoutEffect, useRef } from 'react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/common/EmptyState';
import { CustomerCard } from '@/components/customers/CustomerCard';
import {
  AdaptiveSurface,
  AdaptiveSurfaceContent,
  useOptionalAdaptiveHost,
} from '@/components/layout/adaptiveHostContext';
import { buttonVariants } from '@/components/ui/button';
import { buildAppCustomerCreatePath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import { useCustomerStore } from '@/state/CustomerStoreContext';

export function CustomersPage() {
  const { t } = useTranslation();
  const adaptiveHost = useOptionalAdaptiveHost();
  const { customers } = useCustomerStore();
  const scrollSurfaceRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const scrollSurface = scrollSurfaceRef.current;
    if (!scrollSurface || !adaptiveHost) return;
    scrollSurface.scrollTop = adaptiveHost.customers.listScrollTop;
  }, [adaptiveHost]);

  useEffect(() => {
    const scrollSurface = scrollSurfaceRef.current;
    if (!scrollSurface) return;
    const updateScrollPosition = () => {
      adaptiveHost?.setCustomerListScrollTop(scrollSurface.scrollTop);
    };
    scrollSurface.addEventListener('scroll', updateScrollPosition, { passive: true });
    return () => scrollSurface.removeEventListener('scroll', updateScrollPosition);
  }, [adaptiveHost]);

  return (
    <AdaptiveSurface
      ref={scrollSurfaceRef}
      majorSurface="customer-list"
      data-customers-page
      data-scroll-surface
      data-root-scroll-surface="customers-list"
      className="h-full min-h-full overflow-y-auto p-6 pt-10"
    >
      <AdaptiveSurfaceContent policy="scan">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{t('customers.title')}</h1>
            <p className="text-text-secondary mt-2">{t('customers.description')}</p>
          </div>
          <Link
            to={buildAppCustomerCreatePath()}
            className={cn(buttonVariants({ variant: 'primary', size: 'sm' }), 'shrink-0')}
            data-customer-add-cta
          >
            + {t('customers.add')}
          </Link>
        </header>

        {customers.length === 0 ? (
          <div data-customers-empty className="mt-6">
            <EmptyState
              title={t('customers.emptyTitle')}
              description={t('customers.emptyDescription')}
              action={
                <Link
                  to={buildAppCustomerCreatePath()}
                  className={cn(buttonVariants({ variant: 'primary', size: 'lg' }), 'mt-2')}
                  data-first-customer-cta
                >
                  {t('customers.firstCustomerAction')}
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {customers.map((customer) => (
              <li key={customer.id}>
                <CustomerCard
                  customer={customer}
                  isSelected={adaptiveHost?.customers.selectedCustomerId === customer.id}
                  onSelect={
                    adaptiveHost ? () => adaptiveHost.selectCustomer(customer.id) : undefined
                  }
                />
              </li>
            ))}
          </ul>
        )}
      </AdaptiveSurfaceContent>
    </AdaptiveSurface>
  );
}
