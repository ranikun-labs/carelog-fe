import { useEffect, useRef, useState, type FormEvent } from 'react';

import { LeaveGuard, useLeaveGuardAvailable } from '@/components/common/LeaveGuard';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { TextField } from '@/components/ui/text-field';
import { getCarelogMessageKey } from '@/integrations/carelog/errorMapping';
import { useTranslation } from '@/i18n/I18nContext';
import { useOptionalSaveSession } from '@/state/saveSessionContext';
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

/** onSubmit 두 번째 인자. 성공 뒤 화면을 옮기는 부모는 navigate 전에 allowLeave()를 불러 저장 중 이탈 보호를 놓는다. */
export interface CustomerFormSubmitOptions {
  allowLeave: () => void;
  /** 저장 세션 소유권 확인. 세션 공급자가 없으면 없다(부모는 마운트 여부로 판단). */
  isCurrent?: () => boolean;
}

interface CustomerFormProps {
  mode: CustomerFormMode;
  initialValues?: Partial<CustomerFormValues>;
  draftKey?: CustomerFormDraftKey;
  /** 저장 세션 키(업무 대상). 재마운트·대상 변경에도 저장 중 잠금과 소유권을 유지한다. */
  saveKey?: string;
  onSubmit: (
    values: CustomerFormValues,
    options: CustomerFormSubmitOptions,
  ) => boolean | void | Promise<boolean | void>;
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
  saveKey,
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
  const [nameRequiredError, setNameRequiredError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const session = useOptionalSaveSession();
  const remoteSaving = Boolean(session && saveKey && session.isSaving(saveKey));
  const saving = isSubmitting || remoteSaving;
  const submitLockRef = useRef(false);
  // 저장 진행 중(savingRef)과 이탈 허용(leaveAllowedRef). 이탈 보호는 (입력 있음 || 저장 중) && !허용 이다.
  const savingRef = useRef(false);
  const leaveAllowedRef = useRef(false);
  const lastFieldRef = useRef<HTMLElement | null>(null);
  const guardAvailable = useLeaveGuardAvailable();
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
    setNameRequiredError(false);
    setIsSubmitting(false);
    submitLockRef.current = false;
    savingRef.current = false;
    leaveAllowedRef.current = false;
  }, [draftKey, draftStore, initialSignature, initialValues]);

  function persistDraft(values: CustomerFormValues) {
    if (draftStore && draftKey) draftStore.setDraft(draftKey, values);
  }

  function clearDraft() {
    if (draftStore && draftKey) draftStore.clearDraft(draftKey);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLockRef.current || remoteSaving) return;

    const normalizedDisplayName = displayName.trim();
    if (!normalizedDisplayName) {
      setNameRequiredError(true);
      return;
    }

    submitLockRef.current = true;
    savingRef.current = true;
    leaveAllowedRef.current = false;
    setError(null);
    setNameRequiredError(false);
    setIsSubmitting(true);
    // 요청은 방문(location)당 하나다. 방문 밖(세션 공급자 없음)이면 기존 잠금만 쓴다.
    const token = session && saveKey ? session.beginRequest(saveKey) : null;
    if (session && saveKey && !token) return;
    const endRemote = () => {
      if (session && token) session.finishRequest(token);
    };
    const fail = (submitError?: unknown) => {
      savingRef.current = false;
      endRemote();
      if (submitError !== undefined) setError(t(getCarelogMessageKey(submitError)));
      submitLockRef.current = false;
      setIsSubmitting(false);
    };
    const options: CustomerFormSubmitOptions = {
      allowLeave: () => {
        leaveAllowedRef.current = true;
        if (session && token) session.allowLeave(token);
      },
      ...(session && token ? { isCurrent: () => session.isCurrent(token) } : {}),
    };
    let result: boolean | void | Promise<boolean | void>;
    try {
      result = onSubmit(
        {
          displayName: normalizedDisplayName,
          customerMemo: customerMemo.trim(),
        },
        options,
      );
    } catch (submitError: unknown) {
      fail(submitError);
      return;
    }
    const settle = (outcome: boolean | void) => {
      if (outcome === false) {
        fail();
        return;
      }
      savingRef.current = false;
      endRemote();
      leaveAllowedRef.current = true;
      clearDraft();
    };
    if (result && typeof result === 'object' && 'then' in result) {
      void Promise.resolve(result).then(settle, (submitError: unknown) => fail(submitError));
    } else {
      settle(result);
    }
  }

  function cancel() {
    if (submitLockRef.current) return;
    // 입력이 있으면 이동이 확인 Dialog에 막힐 수 있다. 초안은 "나가기"가 확정될 때(onLeave) 버린다.
    if (!(guardAvailable && hasUnsavedInput())) clearDraft();
    onCancel();
  }

  // 저장 중(저장 뒤 이동 포함)에는 놓아주고, 처음 값과 다른 입력이 있을 때만 이탈을 막는다.
  const hasUnsavedInput = () => {
    if (leaveAllowedRef.current || session?.isLeaveAllowed()) return false;
    if (savingRef.current || remoteSaving) return true;
    return (
      displayName !== (initialValues?.displayName ?? '') ||
      customerMemo !== (initialValues?.customerMemo ?? '')
    );
  };

  return (
    <>
      <form
        data-customer-form
        data-customer-form-mode={mode}
        data-customer-form-key={draftKey}
        aria-busy={saving}
        onSubmit={submit}
        onFocusCapture={(focusEvent) => {
          if (focusEvent.target instanceof HTMLElement) lastFieldRef.current = focusEvent.target;
        }}
        onInvalidCapture={() => setNameRequiredError(true)}
        className="bg-card rounded-card p-4"
      >
        <div className="grid gap-4">
          <TextField
            id="customer-display-name"
            name="displayName"
            data-customer-field="displayName"
            label={t('customers.form.displayName')}
            value={displayName}
            readOnly={saving}
            onChange={(inputEvent) => {
              // 저장 중에는 입력을 받지 않는다(값과 초안이 저장 요청과 어긋나지 않게).
              if (saving) return;
              const nextDisplayName = inputEvent.target.value;
              setDisplayName(nextDisplayName);
              if (nextDisplayName.trim()) setNameRequiredError(false);
              persistDraft({ displayName: nextDisplayName, customerMemo });
            }}
            placeholder={t('customers.form.displayNamePlaceholder')}
            error={nameRequiredError ? t('customers.form.displayNameRequired') : undefined}
            required
          />

          <TextField
            multiline
            id="customer-memo"
            name="customerMemo"
            data-customer-field="customerMemo"
            label={t('customers.form.memo')}
            value={customerMemo}
            readOnly={saving}
            onChange={(inputEvent) => {
              if (saving) return;
              const nextCustomerMemo = inputEvent.target.value;
              setCustomerMemo(nextCustomerMemo);
              persistDraft({ displayName, customerMemo: nextCustomerMemo });
            }}
            rows={4}
            placeholder={t('customers.form.memoPlaceholder')}
          />
        </div>

        {error ? (
          <Notice tone="danger" className="mt-4" data-customer-form-error>
            {error}
          </Notice>
        ) : null}

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="text-neutral"
            onClick={cancel}
            disabled={saving}
            data-customer-form-cancel
          >
            {t('customers.form.cancel')}
          </Button>
          <Button type="submit" disabled={saving} data-customer-form-submit>
            {isEdit ? t('customers.form.save') : t('customers.form.create')}
          </Button>
        </div>
      </form>
      <LeaveGuard
        shouldBlock={hasUnsavedInput}
        onLeave={clearDraft}
        restoreFocusTo={() => lastFieldRef.current}
      />
    </>
  );
}
