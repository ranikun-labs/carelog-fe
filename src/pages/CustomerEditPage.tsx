import { useNavigate, useParams } from 'react-router';

import { CustomerForm, type CustomerFormValues } from '@/components/customers/CustomerForm';
import { PageHeader } from '@/components/common/PageHeader';
import { AdaptiveSurface } from '@/components/layout/adaptiveHostContext';
import { buildAppCustomerDetailPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';
import { AppNotFoundPage } from '@/pages/AppNotFoundPage';
import { useCustomerStore } from '@/state/CustomerStoreContext';

export function CustomerEditPage() {
  const { customerId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const customerStore = useCustomerStore();
  const customer = customerStore.getCustomer(customerId);

  if (!customer) return <AppNotFoundPage />;
  const currentCustomer = customer;

  function handleSubmit(values: CustomerFormValues) {
    const updatedCustomer = customerStore.editCustomer(currentCustomer.id, values);
    if (!updatedCustomer) return false;

    navigate(buildAppCustomerDetailPath(updatedCustomer.id), {
      state: {
        adaptiveRoot: 'customers',
        adaptiveCustomerId: updatedCustomer.id,
      },
    });
    return true;
  }

  return (
    <AdaptiveSurface
      majorSurface="customer-form"
      data-customer-edit-page
      data-editing-customer-id={currentCustomer.id}
      className="flex h-full flex-col"
    >
      <PageHeader
        title={t('customers.form.editTitle')}
        backLabel={t('customers.back')}
        onBack={() => navigate(buildAppCustomerDetailPath(currentCustomer.id))}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <CustomerForm
          mode="edit"
          draftKey={`edit:${currentCustomer.id}`}
          initialValues={{
            displayName: currentCustomer.displayName,
            customerMemo: currentCustomer.customerMemo ?? '',
          }}
          onSubmit={handleSubmit}
          onCancel={() => navigate(buildAppCustomerDetailPath(currentCustomer.id))}
        />
      </div>
    </AdaptiveSurface>
  );
}
