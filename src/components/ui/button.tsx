// upstream: finance-fe@7dd9590:src/components/ui/button.tsx (derived — local patches)
// 로컬 패치 4건(상류 반영 제안 대상, design-foundation.lock.json 의 patches 와 일치해야 한다):
//  1. `primary` alias 추가 — 기존 Carelog 호출부(`variant="primary"`) 호환. PR-10에서 삭제.
//  2. 높이: 고정 `h-12/h-9/h-[54px]` 대신 `min-h-*`. 확대 텍스트가 잘리지 않아야 한다는 RPL-56 계약 유지.
//  3. `text` emphasis 글자를 text-brand-deep으로 — hover 면 brand-subtle 위 Teal strong(4.46:1) 금지 규칙.
//  4. Compact 밀도: default 높이를 `--control-h`(44)로 변수화. sm은 시각 44(기존 Carelog 계약).
import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

/*
 * Foundation v1 버튼 강조(emphasis): strong · subtle · neutral · text · text-neutral ·
 * danger-text · danger-strong. 진한(strong/danger-strong) 버튼은 화면당 1개가 원칙이다.
 * 기존 shadcn 이름(default/destructive/outline/secondary/ghost/link)은 alias로 남겨
 * 호출부를 깨지 않는다 — 신규 코드는 새 이름을 쓴다.
 *
 * 포커스: 전역 :focus-visible(2px brand + offset 2)을 그대로 쓰므로 outline-none을 두지 않는다.
 */
const emphasis = {
  strong: 'bg-primary text-primary-foreground hover:bg-brand-deep active:bg-brand-deep',
  subtle: 'bg-brand-subtle text-brand-deep hover:bg-brand-subtle/70',
  neutral: 'bg-control text-foreground hover:bg-control/70',
  // Carelog 패치: hover 면이 brand-subtle이므로 글자는 deep(Teal strong on subtle 4.46 방지).
  text: 'text-brand-deep hover:bg-brand-subtle',
  'text-neutral': 'text-text-secondary hover:bg-control',
  'danger-text': 'text-danger hover:bg-danger-bg',
  'danger-strong': 'bg-danger-solid text-on-danger-solid hover:opacity-90',
} as const;

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        ...emphasis,
        // --- 호환 alias (기존 호출부) ---
        default: emphasis.strong,
        primary: emphasis.strong,
        destructive: emphasis['danger-strong'],
        secondary: emphasis.neutral,
        outline: emphasis.neutral,
        ghost: emphasis.text,
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        // 기본 컨트롤 높이 48.
        default:
          'min-h-(--control-h) min-w-11 rounded-control px-4 text-[15px] leading-6 has-[>svg]:px-3',
        // Carelog: 시각 높이 44(조작 영역과 동일). 확대 텍스트가 늘어나도록 min-h.
        sm: 'min-h-11 min-w-11 gap-1.5 rounded-control px-3 text-[13px] leading-[18px] has-[>svg]:px-2.5',
        lg: 'min-h-[54px] min-w-11 rounded-control px-6 text-[17px] has-[>svg]:px-4',
        // 아이콘 버튼은 터치 최소 44.
        icon: 'size-11 rounded-control',
      },
    },
    defaultVariants: {
      variant: 'strong',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
