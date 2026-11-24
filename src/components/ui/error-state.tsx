// upstream: finance-fe@7dd9590:src/components/ui/error-state.tsx (verbatim)
import { CircleAlert } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

type ErrorStateProps = Omit<React.ComponentProps<'div'>, 'title'> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** 복구 행동(예: 다시 시도 Button). */
  action?: React.ReactNode;
};

/**
 * 조회·저장 실패 등 복구 가능한 오류 표시. 색만이 아니라 아이콘 + 제목 텍스트로 전달하고
 * `role="alert"`로 스크린리더에 즉시 알린다. 원인 기술 정보는 노출하지 않는다(호출부가 문구 결정).
 */
function ErrorState({ title, description, action, className, ...props }: ErrorStateProps) {
  return (
    <div
      data-slot="error-state"
      role="alert"
      className={cn('flex flex-col items-center gap-3 px-5 py-10 text-center', className)}
      {...props}
    >
      <CircleAlert aria-hidden="true" className="text-danger size-8" />
      <p className="type-content-title text-foreground">{title}</p>
      {description ? (
        <p className="type-supporting text-text-secondary max-w-prose">{description}</p>
      ) : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

export { ErrorState };
