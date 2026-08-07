import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * 범용 시각 primitive. 감정/행동 등 도메인 enum이나 i18n key를 알지 않는다 —
 * 라벨은 항상 `children`으로 호출부가 넘긴다.
 */
const badgeVariants = cva(
  'inline-flex w-fit items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-muted text-muted-foreground',
        info: 'bg-primary/10 text-primary',
        destructive: 'bg-destructive/10 text-destructive',
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
