// upstream: finance-fe@7dd9590:src/components/ui/badge.tsx (derived — local patches)
// 로컬 패치 3건(design-foundation.lock.json 의 patches 와 일치해야 한다):
//  1. `info` 호환 alias를 brand-subtle + brand-deep으로 교체 — Teal strong on subtle(4.46)을 피하는 규칙.
//  2. 기본 클래스에 `shrink-0` 유지 — 기존 Carelog 계약(flex 행에서 배지가 줄어들지 않음).
//  3. Carelog 일정 상태 tone 4종(planned/prepared/overdue/cancelled) 추가 — 제품 의미 계약.
//     Foundation tone의 별칭이므로 새 색을 만들지 않는다. 상류에 올리지 않는다.
import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Status Display(컨트롤 아님): 배지는 상태에만 쓰고 색만으로 전달하지 않는다 — 라벨 텍스트 필수.
 * 범용 시각 primitive. 감정/행동 등 도메인 enum이나 i18n key를 알지 않는다 —
 * 라벨은 항상 `children`으로 호출부가 넘긴다.
 */
const badgeVariants = cva(
  'type-label inline-flex w-fit shrink-0 items-center gap-1 rounded-badge px-2 py-0.5 whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-muted text-text-secondary',
        // Foundation info 상태(브랜드와 독립). 기존 `info`는 호환용 브랜드 tint라 이름이 달라졌다.
        information: 'bg-info-bg text-info',
        success: 'bg-success-bg text-success',
        warning: 'bg-warning-bg text-warning',
        danger: 'bg-danger-bg text-danger',
        conflict: 'bg-conflict-bg text-conflict',
        // 호환 alias — 화면 PR 정리 후 information/danger로 이관하고 제거한다.
        info: 'bg-brand-subtle text-brand-deep',
        destructive: 'bg-danger-bg text-danger',
        // Carelog 일정 상태 문법 (색만으로 전달하지 않도록 호출부가 텍스트 라벨을 넘긴다)
        planned: 'bg-info-bg text-info',
        prepared: 'bg-info-bg text-info',
        overdue: 'bg-warning-bg text-warning',
        cancelled: 'bg-muted text-text-secondary',
      },
    },
    defaultVariants: {
      tone: 'neutral',
    },
  },
);

function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone, className }))} {...props} />;
}

export { Badge };
