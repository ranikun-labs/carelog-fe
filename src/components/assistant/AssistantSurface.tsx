import { useEffect, useRef, useState, type FormEvent } from 'react';

import type { AssistantAdapter, AssistantResult } from '@/assistant/assistantAdapter';
import type { ResolvedAssistantContext } from '@/assistant/assistantTypes';
import { PageHeader } from '@/components/common/PageHeader';
import { AdaptiveSurface, AdaptiveSurfaceContent } from '@/components/layout/adaptiveHostContext';
import { formatAgendaDateTime } from '@/components/schedule/agendaModel';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/I18nContext';

interface AssistantSurfaceProps {
  context: ResolvedAssistantContext;
  adapter: AssistantAdapter | null;
  onBack: () => void;
  onSaveCustomerMemo?: (memo: string) => unknown;
  onSaveEventMemo?: (memo: string) => unknown;
}

type RequestState = 'initial' | 'loading' | 'result' | 'error';

interface SuggestedAction {
  id: string;
  label: string;
}

interface LastRequest {
  question: string;
  suggestedActionId?: string;
}

export function AssistantSurface({
  context,
  adapter,
  onBack,
  onSaveCustomerMemo,
  onSaveEventMemo,
}: AssistantSurfaceProps) {
  const { locale, t } = useTranslation();
  const [question, setQuestion] = useState('');
  const [requestState, setRequestState] = useState<RequestState>('initial');
  const [result, setResult] = useState<AssistantResult | null>(null);
  const [memoDraft, setMemoDraft] = useState('');
  const [isMemoEditing, setIsMemoEditing] = useState(false);
  const [hasSavedMemo, setHasSavedMemo] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [isMemoSaving, setIsMemoSaving] = useState(false);
  const requestLockRef = useRef(false);
  const lastRequestRef = useRef<LastRequest | null>(null);
  const confirmationRef = useRef<HTMLParagraphElement>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (savedMessage) confirmationRef.current?.focus();
  }, [savedMessage]);

  const actions = getSuggestedActions(context.navigation.context.kind, t);
  const isLoading = requestState === 'loading';
  const resultText = result ? formatResultAsMemo(result) : '';

  function requestAssistant(nextRequest: LastRequest) {
    if (!adapter || requestLockRef.current || !nextRequest.question.trim()) return;
    requestLockRef.current = true;
    lastRequestRef.current = nextRequest;
    setRequestState('loading');
    setResult(null);
    setIsMemoEditing(false);
    setHasSavedMemo(false);
    setSaveFailed(false);
    setSavedMessage(null);

    void adapter
      .request({
        context: context.navigation.context,
        question: nextRequest.question.trim(),
        ...(nextRequest.suggestedActionId
          ? { suggestedActionId: nextRequest.suggestedActionId }
          : {}),
      })
      .then((nextResult) => {
        setResult(nextResult);
        setRequestState('result');
      })
      .catch(() => {
        setRequestState('error');
      })
      .finally(() => {
        requestLockRef.current = false;
      });
  }

  function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    requestAssistant({ question });
  }

  function chooseSuggestedAction(action: SuggestedAction) {
    setQuestion(action.label);
    requestAssistant({ question: action.label, suggestedActionId: action.id });
  }

  function retry() {
    if (lastRequestRef.current) requestAssistant(lastRequestRef.current);
  }

  function beginMemoEdit() {
    if (!result || hasSavedMemo) return;
    const existingMemo =
      context.navigation.context.kind === 'customer'
        ? context.customer.customerMemo
        : context.event?.note;
    setMemoDraft(existingMemo?.trim() ? `${existingMemo.trim()}\n\n${resultText}` : resultText);
    setSaveFailed(false);
    setIsMemoSaving(false);
    setSavedMessage(null);
    setIsMemoEditing(true);
  }

  async function saveMemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isMemoSaving) return;
    const normalizedMemo = memoDraft.trim();
    setSaveFailed(false);
    setSavedMessage(null);

    try {
      const saved =
        context.navigation.context.kind === 'customer'
          ? onSaveCustomerMemo?.(normalizedMemo)
          : onSaveEventMemo?.(normalizedMemo);
      if (!saved) {
        setSaveFailed(true);
        return;
      }

      setIsMemoSaving(true);
      await Promise.resolve(saved);
      setIsMemoEditing(false);
      setHasSavedMemo(true);
      setSavedMessage(
        context.navigation.context.kind === 'customer'
          ? t('assistant.savedCustomerMemo')
          : t('assistant.savedEventMemo'),
      );
    } catch {
      setSaveFailed(true);
    } finally {
      setIsMemoSaving(false);
    }
  }

  return (
    <AdaptiveSurface
      majorSurface="assistant"
      data-assistant-page
      data-assistant-context-kind={context.navigation.context.kind}
      aria-busy={isLoading}
      className="flex h-full flex-col"
    >
      <PageHeader title={t('assistant.title')} backLabel={t('assistant.back')} onBack={onBack} />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <AdaptiveSurfaceContent policy="readable">
          <section
            data-assistant-context
            aria-labelledby="assistant-context-title"
            className="border-border-default bg-subtle rounded-lg border p-4"
          >
            <p id="assistant-context-title" className="text-text-tertiary text-xs font-semibold">
              {t('assistant.contextTitle')}
            </p>
            <div className="mt-2 min-w-0">
              <p className="text-text-secondary text-sm">
                {getContextLabel(context.navigation.context.kind, t)}
              </p>
              <p className="text-text-primary mt-1 text-lg font-semibold break-words">
                {context.customer.displayName}
              </p>
              {context.event ? (
                <p className="text-text-secondary mt-1 text-sm break-words">
                  {context.event.descriptor ?? t('schedule.untitled')} ·{' '}
                  <time dateTime={getEventTime(context.event)}>
                    {formatAgendaDateTime(getEventTime(context.event), locale)}
                  </time>
                </p>
              ) : null}
            </div>
          </section>

          <section className="mt-6" aria-labelledby="assistant-suggested-title">
            <h2 id="assistant-suggested-title" className="text-text-primary text-lg font-semibold">
              {t('assistant.suggestedTitle')}
            </h2>
            <p className="text-text-secondary mt-1 text-sm">{t('assistant.initialDescription')}</p>
            <div className="mt-3 grid gap-2" data-assistant-suggested-actions>
              {actions.map((action) => (
                <Button
                  key={action.id}
                  type="button"
                  variant="outline"
                  className="h-auto min-h-11 justify-start text-left whitespace-normal"
                  disabled={!adapter || isLoading}
                  data-assistant-suggested-action={action.id}
                  onClick={() => chooseSuggestedAction(action)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </section>

          {!adapter ? (
            <section
              data-assistant-unavailable
              role="status"
              className="border-border-default bg-subtle mt-6 rounded-lg border p-4"
            >
              <h2 className="text-text-primary text-sm font-semibold">
                {t('assistant.unavailableTitle')}
              </h2>
              <p className="text-text-secondary mt-1 text-sm">
                {t('assistant.unavailableDescription')}
              </p>
            </section>
          ) : null}

          <form
            className="border-border-default mt-6 rounded-lg border p-4"
            onSubmit={submitQuestion}
          >
            <label
              htmlFor="assistant-question"
              className="text-text-primary grid gap-1.5 text-sm font-semibold"
            >
              {t('assistant.questionLabel')}
              <input
                id="assistant-question"
                data-assistant-question
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={t('assistant.questionPlaceholder')}
                disabled={!adapter || isLoading}
                className="border-border-default bg-surface text-text-primary focus-visible:outline-accent-primary min-h-11 rounded-md border px-3 font-normal outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
              />
            </label>
            <Button
              type="submit"
              className="mt-3 w-full sm:w-auto"
              disabled={!adapter || isLoading || !question.trim()}
              data-assistant-submit
            >
              {isLoading ? t('assistant.loading') : t('assistant.ask')}
            </Button>
          </form>

          {isLoading ? (
            <p
              role="status"
              aria-live="polite"
              data-assistant-loading
              className="text-text-secondary mt-6 rounded-lg border border-dashed p-4 text-sm"
            >
              {t('assistant.loading')}
            </p>
          ) : null}

          {requestState === 'error' ? (
            <section
              role="alert"
              data-assistant-error
              className="border-border-default bg-subtle mt-6 rounded-lg border p-4"
            >
              <h2 className="text-text-primary text-sm font-semibold">
                {t('assistant.errorTitle')}
              </h2>
              <p className="text-text-secondary mt-1 text-sm">{t('assistant.errorDescription')}</p>
              <Button type="button" variant="outline" className="mt-3" onClick={retry}>
                {t('assistant.retry')}
              </Button>
            </section>
          ) : null}

          {result ? (
            <section
              data-assistant-result
              aria-labelledby="assistant-result-title"
              className="border-border-default mt-6 rounded-lg border p-4"
            >
              <h2 id="assistant-result-title" className="text-text-primary text-lg font-semibold">
                {t('assistant.resultTitle')}
              </h2>
              <p className="text-text-primary mt-3 leading-7">{result.summary}</p>
              <ul className="text-text-secondary mt-3 list-disc space-y-2 pl-5 text-sm">
                {result.nextSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <p className="text-text-tertiary mt-4 text-xs">{t('assistant.fixtureNotice')}</p>

              {!hasSavedMemo && !isMemoEditing ? (
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4 w-full sm:w-auto"
                  data-assistant-add-to-memo
                  onClick={beginMemoEdit}
                >
                  {t('assistant.addToMemo')}
                </Button>
              ) : null}

              {isMemoEditing ? (
                <form
                  data-assistant-memo-form
                  onSubmit={saveMemo}
                  className="border-border-subtle bg-subtle mt-4 rounded-lg border p-4"
                >
                  <h3 className="text-text-primary text-sm font-semibold">
                    {t('assistant.memoEditorTitle')}
                  </h3>
                  <label
                    htmlFor="assistant-memo"
                    className="text-text-primary mt-3 grid gap-1.5 text-sm font-semibold"
                  >
                    {context.navigation.context.kind === 'customer'
                      ? t('customers.form.memo')
                      : t('eventDetail.memo')}
                    <textarea
                      id="assistant-memo"
                      data-assistant-memo
                      value={memoDraft}
                      onChange={(event) => setMemoDraft(event.target.value)}
                      placeholder={t('assistant.memoPlaceholder')}
                      rows={6}
                      className="border-border-default bg-surface text-text-primary focus-visible:outline-accent-primary rounded-md border px-3 py-2 font-normal outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
                    />
                  </label>
                  {saveFailed ? (
                    <p role="alert" className="text-warning mt-3 text-sm font-semibold">
                      {t('assistant.saveError')}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      data-assistant-memo-cancel
                      onClick={() => setIsMemoEditing(false)}
                    >
                      {t('assistant.cancelMemo')}
                    </Button>
                    <Button type="submit" data-assistant-memo-save disabled={isMemoSaving}>
                      {t('assistant.saveMemo')}
                    </Button>
                  </div>
                </form>
              ) : null}

              {savedMessage ? (
                <p
                  ref={confirmationRef}
                  tabIndex={-1}
                  role="status"
                  data-assistant-save-confirmation
                  className="border-accent-primary bg-accent-primary-bg text-accent-primary-deep mt-4 rounded-md border p-3 text-sm font-semibold outline-none"
                >
                  {savedMessage}
                </p>
              ) : null}
            </section>
          ) : null}
        </AdaptiveSurfaceContent>
      </div>
    </AdaptiveSurface>
  );
}

function getSuggestedActions(
  kind: ResolvedAssistantContext['navigation']['context']['kind'],
  t: ReturnType<typeof useTranslation>['t'],
): SuggestedAction[] {
  if (kind === 'customer') {
    return [
      { id: 'customer-recent-flow', label: t('assistant.suggestedActions.customer.recentFlow') },
      {
        id: 'customer-next-questions',
        label: t('assistant.suggestedActions.customer.nextQuestions'),
      },
      { id: 'customer-prepare', label: t('assistant.suggestedActions.customer.prepare') },
      { id: 'customer-important', label: t('assistant.suggestedActions.customer.important') },
    ];
  }

  if (kind === 'planned-event') {
    return [
      { id: 'planned-prepare', label: t('assistant.suggestedActions.plannedEvent.prepare') },
      { id: 'planned-questions', label: t('assistant.suggestedActions.plannedEvent.questions') },
      { id: 'planned-connect', label: t('assistant.suggestedActions.plannedEvent.connect') },
    ];
  }

  return [
    { id: 'occurred-summarize', label: t('assistant.suggestedActions.occurredEvent.summarize') },
    {
      id: 'occurred-next-questions',
      label: t('assistant.suggestedActions.occurredEvent.nextQuestions'),
    },
    { id: 'occurred-follow-up', label: t('assistant.suggestedActions.occurredEvent.followUp') },
  ];
}

function getContextLabel(
  kind: ResolvedAssistantContext['navigation']['context']['kind'],
  t: ReturnType<typeof useTranslation>['t'],
): string {
  if (kind === 'customer') return t('assistant.customerContext');
  if (kind === 'planned-event') return t('assistant.plannedEventContext');
  return t('assistant.occurredEventContext');
}

function getEventTime(event: NonNullable<ResolvedAssistantContext['event']>): string {
  if (event.status === 'OCCURRED') return event.occurredAt;
  return event.scheduledAt;
}

function formatResultAsMemo(result: AssistantResult): string {
  return [result.summary, ...result.nextSteps.map((step) => `- ${step}`)].join('\n');
}
