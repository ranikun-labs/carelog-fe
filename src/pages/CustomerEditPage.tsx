import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';

import { CustomerForm, type CustomerFormValues } from '@/components/customers/CustomerForm';
import { PageHeader } from '@/components/common/PageHeader';
import { AdaptiveSurface } from '@/components/layout/adaptiveHostContext';
import { buildAppCustomerDetailPath } from '@/constants/routes';
import { useTranslation } from '@/i18n/I18nContext';
import { getCarelogMessageKey } from '@/integrations/carelog/errorMapping';
import { AppNotFoundPage } from '@/pages/AppNotFoundPage';
import { useCustomerStore } from '@/state/CustomerStoreContext';

export function CustomerEditPage() {
  const { customerId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const customerStore = useCustomerStore();
  const customer = customerStore.getCustomer(customerId);

  useEffect(() => {
    if (!customerStore.remoteReadsEnabled || customer || !customerId) return;
    if (customerStore.detailLoadState !== 'idle') return;
    void customerStore.loadCustomer(customerId).catch(() => undefined);
  }, [customer, customerId, customerStore]);

  if (!customer) {
    if (customerStore.detailLoadState === 'loading' || customerStore.loadState === 'loading') {
      return (
        <div role="status" aria-busy="true" className="p-6">
          {t('schedule.loadingLabel')}
        </div>
      );
    }
    if (customerStore.error) {
      return (
        <div role="alert" className="p-6">
          {t(getCarelogMessageKey(customerStore.error))}
        </div>
      );
    }
    return <AppNotFoundPage />;
  }
  const currentCustomer = customer;

  async function handleSubmit(values: CustomerFormValues) {
    const updatedCustomer = await customerStore.editCustomer(currentCustomer.id, values);

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
