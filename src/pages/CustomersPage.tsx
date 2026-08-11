import { useEffect, useLayoutEffect, useRef } from 'react';

import { CustomerCard } from '@/components/customers/CustomerCard';
import { AdaptiveSurface, useOptionalAdaptiveHost } from '@/components/layout/adaptiveHostContext';
import { SCENARIO_FIXTURES } from '@/fixtures/scenarios';
import { useTranslation } from '@/i18n/I18nContext';

export function CustomersPage() {
  const { t } = useTranslation();
  const adaptiveHost = useOptionalAdaptiveHost();
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
      <h1 className="text-3xl font-bold">{t('customers.title')}</h1>
      <p className="text-text-secondary mt-2">{t('customers.description')}</p>
      <ul className="mt-6 space-y-3">
        {SCENARIO_FIXTURES.map((scenario) => (
          <li key={scenario.customer.id}>
            <CustomerCard
              scenario={scenario}
              isSelected={adaptiveHost?.customers.selectedCustomerId === scenario.customer.id}
              onSelect={
                adaptiveHost ? () => adaptiveHost.selectCustomer(scenario.customer.id) : undefined
              }
            />
          </li>
        ))}
      </ul>
    </AdaptiveSurface>
  );
}
