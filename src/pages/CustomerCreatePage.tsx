import { useNavigate } from 'react-router';

import { CustomerForm, type CustomerFormValues } from '@/components/customers/CustomerForm';
import { PageHeader } from '@/components/common/PageHeader';
import { AdaptiveSurface } from '@/components/layout/adaptiveHostContext';
import { buildAppCustomerDetailPath, buildAppCustomersPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';
import { useCustomerStore } from '@/state/CustomerStoreContext';

export function CustomerCreatePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const customerStore = useCustomerStore();

  function handleSubmit(values: CustomerFormValues) {
    const customer = customerStore.createCustomer(values);
    if (!customer) return;

    navigate(buildAppCustomerDetailPath(customer.id), {
      state: {
        adaptiveRoot: 'customers',
        adaptiveCustomerId: customer.id,
      },
    });
  }

  return (
    <AdaptiveSurface
      majorSurface="customer-form"
      data-customer-create-page
      className="flex h-full flex-col"
    >
      <PageHeader
        title={t('customers.form.createTitle')}
        backLabel={t('customers.back')}
        onBack={() => navigate(buildAppCustomersPath())}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <CustomerForm
          mode="create"
          onSubmit={handleSubmit}
          onCancel={() => navigate(buildAppCustomersPath())}
        />
      </div>
    </AdaptiveSurface>
  );
}
