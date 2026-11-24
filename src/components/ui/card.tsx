// upstream: finance-fe@7dd9590:src/components/ui/card.tsx (verbatim)
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Foundation v1: 테두리·그림자 없이 page 대비 surface로 구분한다(반경 16).
 * `inset`은 카드 안의 면(반경 12) — 중첩은 inset만 허용한다.
 * 화면별 padding/레이아웃은 호출부 책임.
 */
function Card({
  className,
  inset = false,
  ...props
}: React.ComponentProps<'div'> & { inset?: boolean }) {
  return (
    <div
      data-slot="card"
      className={cn(
        inset
          ? 'bg-inset text-card-foreground rounded-inset'
          : 'bg-card text-card-foreground rounded-card',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex flex-col gap-1.5 p-5', className)}
      {...props}
    />
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-title" className={cn('type-content-title', className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-description"
      className={cn('type-supporting text-text-secondary', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('p-5 pt-0', className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex items-center p-5 pt-0', className)}
      {...props}
    />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
