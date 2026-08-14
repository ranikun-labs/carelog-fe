import { useEffect, useRef, useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { getCarelogMessageKey } from '@/integrations/carelog/errorMapping';
import { useTranslation } from '@/i18n/I18nContext';
import {
  useOptionalCustomerFormDraft,
  type CustomerFormDraftKey,
  type CustomerFormDraft,
} from '@/state/CustomerFormDraftContext';

export type CustomerFormMode = 'create' | 'edit';

export interface CustomerFormValues {
  displayName: string;
  customerMemo: string;
}

interface CustomerFormProps {
  mode: CustomerFormMode;
  initialValues?: Partial<CustomerFormValues>;
  draftKey?: CustomerFormDraftKey;
  onSubmit: (values: CustomerFormValues) => boolean | void | Promise<boolean | void>;
  onCancel: () => void;
}

function readInitialValues(
  initialValues: Partial<CustomerFormValues> | undefined,
  draft: CustomerFormDraft | undefined,
): CustomerFormValues {
  return {
    displayName: draft?.displayName ?? initialValues?.displayName ?? '',
    customerMemo: draft?.customerMemo ?? initialValues?.customerMemo ?? '',
  };
}

export function CustomerForm({
  mode,
  initialValues,
  draftKey,
  onSubmit,
  onCancel,
}: CustomerFormProps) {
  const { t } = useTranslation();
  const draftStore = useOptionalCustomerFormDraft();
  const initialDraft = draftKey ? draftStore?.getDraft(draftKey) : undefined;
  const initialFormValues = readInitialValues(initialValues, initialDraft);
  const initialSignature = `${initialValues?.displayName ?? ''}\u0000${initialValues?.customerMemo ?? ''}`;
  const [displayName, setDisplayName] = useState(initialFormValues.displayName);
  const [customerMemo, setCustomerMemo] = useState(initialFormValues.customerMemo);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);
  const initializationRef = useRef({ draftKey, initialSignature });
  const isEdit = mode === 'edit';

  useEffect(() => {
    const previous = initializationRef.current;
    if (previous.draftKey === draftKey && previous.initialSignature === initialSignature) return;

    initializationRef.current = { draftKey, initialSignature };
    const nextValues = readInitialValues(
      initialValues,
      draftKey ? draftStore?.getDraft(draftKey) : undefined,
    );
    setDisplayName(nextValues.displayName);
    setCustomerMemo(nextValues.customerMemo);
    setError(null);
    setIsSubmitting(false);
    submitLockRef.current = false;
  }, [draftKey, draftStore, initialSignature, initialValues]);

  function persistDraft(values: CustomerFormValues) {
    if (draftStore && draftKey) draftStore.setDraft(draftKey, values);
  }

  function clearDraft() {
    if (draftStore && draftKey) draftStore.clearDraft(draftKey);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLockRef.current) return;

    const normalizedDisplayName = displayName.trim();
    if (!normalizedDisplayName) {
      setError(t('customers.form.displayNameRequired'));
      return;
    }

    submitLockRef.current = true;
    setError(null);
    setIsSubmitting(true);
    let result: boolean | void | Promise<boolean | void>;
    try {
      result = onSubmit({
        displayName: normalizedDisplayName,
        customerMemo: customerMemo.trim(),
      });
    } catch (submitError: unknown) {
      setError(t(getCarelogMessageKey(submitError)));
      submitLockRef.current = false;
      setIsSubmitting(false);
      return;
    }
    const settle = (outcome: boolean | void) => {
      if (outcome === false) {
        submitLockRef.current = false;
        setIsSubmitting(false);
        return;
      }
      clearDraft();
    };
    if (result && typeof result === 'object' && 'then' in result) {
      void Promise.resolve(result)
        .then(settle)
        .catch((submitError: unknown) => {
          setError(t(getCarelogMessageKey(submitError)));
          submitLockRef.current = false;
          setIsSubmitting(false);
        });
    } else {
      settle(result);
    }
  }

  function cancel() {
    if (submitLockRef.current) return;
    clearDraft();
    onCancel();
  }

  return (
    <form
      data-customer-form
      data-customer-form-mode={mode}
      data-customer-form-key={draftKey}
      aria-busy={isSubmitting}
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
            onChange={(inputEvent) => {
              const nextDisplayName = inputEvent.target.value;
              setDisplayName(nextDisplayName);
              persistDraft({ displayName: nextDisplayName, customerMemo });
            }}
            placeholder={t('customers.form.displayNamePlaceholder')}
            aria-invalid={error ? true : undefined}
            required
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
            onChange={(inputEvent) => {
              const nextCustomerMemo = inputEvent.target.value;
              setCustomerMemo(nextCustomerMemo);
              persistDraft({ displayName, customerMemo: nextCustomerMemo });
            }}
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
        <Button
          type="button"
          variant="ghost"
          onClick={cancel}
          disabled={isSubmitting}
          data-customer-form-cancel
        >
          {t('customers.form.cancel')}
        </Button>
        <Button type="submit" disabled={isSubmitting} data-customer-form-submit>
          {isEdit ? t('customers.form.save') : t('customers.form.create')}
        </Button>
      </div>
    </form>
  );
}
