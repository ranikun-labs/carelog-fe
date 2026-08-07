import { CustomerCard } from '@/components/customers/CustomerCard';
import { SCENARIO_FIXTURES } from '@/fixtures/scenarios';
import { useTranslation } from '@/i18n/I18nContext';

export function CustomersPage() {
  const { t } = useTranslation();
  return (
    <main className="p-6 pt-10">
      <h1 className="text-3xl font-bold">{t('customers.title')}</h1>
      <p className="text-text-secondary mt-2">{t('customers.description')}</p>
      <ul className="mt-6 space-y-3">
        {SCENARIO_FIXTURES.map((scenario) => (
          <li key={scenario.customer.id}>
            <CustomerCard scenario={scenario} />
          </li>
        ))}
      </ul>
    </main>
  );
}
