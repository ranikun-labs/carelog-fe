// upstream: finance-fe@1c7b014:src/components/ui/text-field.tsx (verbatim)
import * as React from 'react';

import { FieldMessage } from '@/components/ui/field-message';
import { cn } from '@/lib/utils';

type CommonProps = {
  label: React.ReactNode;
  /** 입력 아래 도움말. 오류가 있어도 계속 보인다. */
  hint?: React.ReactNode;
  /** 검증 오류. 있으면 `aria-invalid`와 `role="alert"` 메시지가 붙는다. */
  error?: React.ReactNode;
  /** 입력 면. 카드 위에서는 `card`, 카드 안에 놓을 때 구분이 필요하면 `inset`. */
  fill?: 'card' | 'inset';
  /** 필드 래퍼(label+입력+메시지)에 적용할 클래스. */
  className?: string;
};

type TextFieldProps =
  | (CommonProps &
      Omit<React.ComponentProps<'input'>, 'className' | 'children'> & { multiline?: false })
  | (CommonProps &
      Omit<React.ComponentProps<'textarea'>, 'className' | 'children'> & { multiline: true });

const controlBase =
  'type-body text-foreground placeholder:text-text-tertiary border-input w-full min-w-0 border ' +
  'rounded-control px-4 break-keep wrap-anywhere ' +
  'aria-invalid:border-danger disabled:bg-control disabled:text-text-disabled';

const fillClass = { card: 'bg-card', inset: 'bg-inset' } as const;

/**
 * 라벨·입력·도움말·오류를 한 곳에서 연결한다(`<label for>`, `aria-describedby`, `aria-invalid`).
 * 접근성 설명(`aria-describedby`)은 도움말과 오류를 함께 가리킨다(오류 중에도 도움말 id 유지).
 * 포커스 표시는 전역 `:focus-visible` 규칙을 그대로 쓰므로 개별 ring을 두지 않는다.
 * 도메인 key·i18n은 알지 못한다 — 문구는 호출부가 넘긴다.
 */
function TextField(props: TextFieldProps) {
  const { label, hint, error, fill = 'card', className, id: idProp, ...rest } = props;
  const generatedId = React.useId();
  const id = idProp ?? generatedId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasError = error !== undefined && error !== null && error !== false && error !== '';
  const hasHint = hint !== undefined && hint !== null && hint !== false && hint !== '';
  const describedBy =
    [hasHint ? hintId : null, hasError ? errorId : null].filter(Boolean).join(' ') || undefined;
  const classes = (extra: string) => cn(controlBase, fillClass[fill], extra);

  let control: React.ReactNode;
  if (rest.multiline) {
    const { multiline, ...textareaProps } = rest;
    void multiline;
    control = (
      <textarea
        {...textareaProps}
        id={id}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        className={classes('min-h-30 resize-y py-3')}
      />
    );
  } else {
    const { multiline, ...inputProps } = rest;
    void multiline;
    control = (
      <input
        {...inputProps}
        id={id}
        aria-invalid={hasError}
        aria-describedby={describedBy}
        className={classes('h-12')}
      />
    );
  }

  return (
    <div data-slot="text-field" className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={id} className="type-content-title text-foreground">
        {label}
      </label>
      {control}
      {hasHint ? <FieldMessage id={hintId}>{hint}</FieldMessage> : null}
      {hasError ? (
        <FieldMessage id={errorId} tone="error">
          {error}
        </FieldMessage>
      ) : null}
    </div>
  );
}

export { TextField };
export type { TextFieldProps };
