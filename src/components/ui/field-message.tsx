// upstream: finance-fe@1c7b014:src/components/ui/field-message.tsx (verbatim)
import { CircleAlert } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

type FieldMessageProps = React.ComponentProps<'p'> & {
  /** `hint`는 도움말, `error`는 검증 오류. 오류는 아이콘+텍스트로 전달하고 `role="alert"`로 알린다. */
  tone?: 'hint' | 'error';
};

/**
 * 입력 필드 아래 한 줄 안내. 색만으로 상태를 전달하지 않도록 오류에는 아이콘을 함께 둔다.
 * 문구·번역은 호출부가 children으로 넘긴다.
 */
function FieldMessage({ tone = 'hint', className, children, ...props }: FieldMessageProps) {
  if (tone === 'error') {
    return (
      <p
        data-slot="field-message"
        data-tone="error"
        role="alert"
        className={cn('type-supporting text-danger flex items-start gap-1.5 break-keep', className)}
        {...props}
      >
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 wrap-anywhere">{children}</span>
      </p>
    );
  }

  return (
    <p
      data-slot="field-message"
      data-tone="hint"
      className={cn('type-supporting text-text-secondary break-keep', className)}
      {...props}
    >
      {children}
    </p>
  );
}

export { FieldMessage };
