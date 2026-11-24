// upstream: finance-fe@1c7b014:src/components/ui/notice.tsx (verbatim)
import { CircleAlert, CircleCheck, GitCompareArrows, Info, TriangleAlert } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

type NoticeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'conflict';

type NoticeProps = Omit<React.ComponentProps<'div'>, 'title'> & {
  tone?: NoticeTone;
  title?: React.ReactNode;
  /** 기본은 tone별 아이콘(neutral은 없음). `null`이면 아이콘을 두지 않는다. */
  icon?: React.ReactNode | null;
  /** 안내 아래의 행동(예: text Button). */
  action?: React.ReactNode;
};

const toneClass: Record<NoticeTone, string> = {
  neutral: 'bg-inset text-text-body',
  info: 'bg-info-bg text-info',
  success: 'bg-success-bg text-success',
  warning: 'bg-warning-bg text-warning',
  danger: 'bg-danger-bg text-danger',
  conflict: 'bg-conflict-bg text-conflict',
};

const toneIcon: Record<NoticeTone, React.ComponentType<{ className?: string }> | null> = {
  neutral: null,
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: CircleAlert,
  conflict: GitCompareArrows,
};

/** 오류성(warning·danger)은 즉시 알리고, 정적 고지(neutral)는 note, 나머지는 status. */
const toneRole: Record<NoticeTone, 'note' | 'status' | 'alert'> = {
  neutral: 'note',
  info: 'status',
  success: 'status',
  warning: 'alert',
  danger: 'alert',
  conflict: 'status',
};

/**
 * 상태·정책 안내 면(inset). 테두리·그림자 없이 면 색 + 아이콘/제목으로 상태를 전달한다.
 * 사용 규칙: neutral은 Light에서 inset이 page와 동색이므로 page 위에 직접 두지 말고 Card 안에 둔다
 * (상태 tone은 자체 bg라 어디서든 보인다).
 * 문구·번역은 호출부가 넘긴다. 본문은 중립 글자색을 유지해 가독성(4.5:1)을 지킨다.
 */
function Notice({
  tone = 'neutral',
  title,
  icon,
  action,
  className,
  children,
  ...props
}: NoticeProps) {
  const DefaultIcon = toneIcon[tone];
  const leading =
    icon === null ? null : (icon ?? (DefaultIcon ? <DefaultIcon className="size-4" /> : null));

  return (
    <div
      data-slot="notice"
      data-tone={tone}
      role={toneRole[tone]}
      className={cn('rounded-inset flex gap-3 p-4', toneClass[tone], className)}
      {...props}
    >
      {leading ? (
        <span aria-hidden="true" className="mt-0.5 shrink-0">
          {leading}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title ? <p className="type-label">{title}</p> : null}
        <div className="type-supporting text-foreground wrap-anywhere break-keep">{children}</div>
        {action ? <div className="mt-1">{action}</div> : null}
      </div>
    </div>
  );
}

export { Notice };
export type { NoticeProps, NoticeTone };
