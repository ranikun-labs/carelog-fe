// upstream: finance-fe@7dd9590:src/components/ui/info-row.tsx (verbatim)
import * as React from 'react';

import { cn } from '@/lib/utils';

/** `<dl>` 컨테이너. 행 사이는 divider(hairline)로만 나눈다. */
function InfoList({ className, ...props }: React.ComponentProps<'dl'>) {
  return (
    <dl
      data-slot="info-list"
      className={cn('divide-border divide-y [&>div:first-child]:pt-0', className)}
      {...props}
    />
  );
}

type InfoRowProps = Omit<React.ComponentProps<'div'>, 'children'> & {
  label: React.ReactNode;
  children: React.ReactNode;
  /**
   * `row`(kv-row): 라벨 왼쪽·값 오른쪽 한 줄 — 짧은 값.
   * `stack`(kv-stack): 라벨 위·값 아래 — 긴 값이나 좁은 폭.
   */
  layout?: 'row' | 'stack';
};

/** Information Row. 반드시 `<InfoList>`(dl) 안에서 쓴다. 라벨=dt, 값=dd. */
function InfoRow({ label, children, layout = 'row', className, ...props }: InfoRowProps) {
  return (
    <div
      data-slot="info-row"
      data-layout={layout}
      className={cn(
        'py-3',
        layout === 'row' ? 'flex items-baseline justify-between gap-4' : 'flex flex-col gap-1',
        className,
      )}
      {...props}
    >
      <dt className="type-supporting text-text-secondary shrink-0">{label}</dt>
      <dd
        className={cn(
          'type-body text-foreground min-w-0 break-words',
          layout === 'row' && 'text-right',
        )}
      >
        {children}
      </dd>
    </div>
  );
}

export { InfoList, InfoRow };
