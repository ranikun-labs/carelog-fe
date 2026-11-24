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
import { ErrorState } from '@/components/ui/error-state';
import { buildAppCustomerCreatePath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';
import { cn } from '@/lib/utils';
import { getCarelogMessageKey } from '@/integrations/carelog/errorMapping';
import { useCustomerStore } from '@/state/CustomerStoreContext';

export function CustomersPage() {
  const { t } = useTranslation();
  const adaptiveHost = useOptionalAdaptiveHost();
  const customerStore = useCustomerStore();
  const { customers } = customerStore;
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
      className="h-full min-h-full overflow-y-auto p-4 pt-8 md:p-6 md:pt-10"
    >
      <AdaptiveSurfaceContent policy="scan">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="type-page-title text-foreground break-keep">{t('customers.title')}</h1>
            <p className="type-supporting text-text-secondary mt-1 break-keep">
              {t('customers.description')}
            </p>
          </div>
          {customers.length > 0 ? (
            <Link
              to={buildAppCustomerCreatePath()}
              className={cn(buttonVariants({ variant: 'strong', size: 'sm' }), 'shrink-0')}
              data-customer-add-cta
            >
              + {t('customers.add')}
            </Link>
          ) : null}
        </header>

        {customerStore.loadState === 'loading' ? (
          <p role="status" aria-busy="true" className="type-body text-text-secondary mt-6">
            {t('customers.loadingLabel')}
          </p>
        ) : customerStore.loadState === 'error' ? (
          <ErrorState
            className="mt-6"
            title={
              customerStore.error
                ? t(getCarelogMessageKey(customerStore.error))
                : t('carelog.unknown')
            }
            action={
              <button
                type="button"
                className={buttonVariants({ variant: 'subtle' })}
                onClick={() => void customerStore.refresh().catch(() => undefined)}
              >
                {t('schedule.retry')}
              </button>
            }
          />
        ) : customers.length === 0 ? (
          <div data-customers-empty className="mt-6">
            <EmptyState
              title={t('customers.emptyTitle')}
              description={t('customers.emptyDescription')}
              action={
                <Link
                  to={buildAppCustomerCreatePath()}
                  className={cn(buttonVariants({ variant: 'strong', size: 'lg' }), 'mt-2')}
                  data-first-customer-cta
                >
                  {t('customers.firstCustomerAction')}
                </Link>
              }
            />
          </div>
        ) : (
          <ul className="divide-border mt-6 divide-y">
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
