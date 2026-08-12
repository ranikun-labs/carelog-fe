import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/I18nContext';

export type CustomerFormMode = 'create' | 'edit';

export interface CustomerFormValues {
  displayName: string;
  customerMemo: string;
}

interface CustomerFormProps {
  mode: CustomerFormMode;
  initialValues?: Partial<CustomerFormValues>;
  onSubmit: (values: CustomerFormValues) => void;
  onCancel: () => void;
}

export function CustomerForm({ mode, initialValues, onSubmit, onCancel }: CustomerFormProps) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState(initialValues?.displayName ?? '');
  const [customerMemo, setCustomerMemo] = useState(initialValues?.customerMemo ?? '');
  const [error, setError] = useState<string | null>(null);
  const isEdit = mode === 'edit';

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedDisplayName = displayName.trim();
    if (!normalizedDisplayName) {
      setError(t('customers.form.displayNameRequired'));
      return;
    }

    setError(null);
    onSubmit({
      displayName: normalizedDisplayName,
      customerMemo: customerMemo.trim(),
    });
  }

  return (
    <form
      data-customer-form
      data-customer-form-mode={mode}
      onSubmit={submit}
      className="border-border-default bg-surface rounded-lg border p-4"
    >
      <div className="grid gap-4">
        <label className="grid gap-1.5 text-sm font-semibold" htmlFor="customer-display-name">
          {t('customers.form.displayName')}
          <input
            id="customer-display-name"
            name="displayName"
            data-customer-field="displayName"
            value={displayName}
            onChange={(inputEvent) => setDisplayName(inputEvent.target.value)}
            placeholder={t('customers.form.displayNamePlaceholder')}
            aria-invalid={error ? true : undefined}
            required
            autoFocus
            className="border-border-default bg-surface text-text-primary focus-visible:outline-accent-primary min-h-11 rounded-md border px-3 font-normal outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </label>

        <label className="grid gap-1.5 text-sm font-semibold" htmlFor="customer-memo">
          {t('customers.form.memo')}
          <textarea
            id="customer-memo"
            name="customerMemo"
            data-customer-field="customerMemo"
            value={customerMemo}
            onChange={(inputEvent) => setCustomerMemo(inputEvent.target.value)}
            rows={4}
            placeholder={t('customers.form.memoPlaceholder')}
            className="border-border-default bg-surface text-text-primary focus-visible:outline-accent-primary rounded-md border px-3 py-2 font-normal outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
          />
        </label>
      </div>

      {error ? (
        <p role="alert" className="text-warning mt-3 text-sm font-semibold">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel} data-customer-form-cancel>
          {t('customers.form.cancel')}
        </Button>
        <Button type="submit" data-customer-form-submit>
          {isEdit ? t('customers.form.save') : t('customers.form.create')}
        </Button>
      </div>
    </form>
  );
}
