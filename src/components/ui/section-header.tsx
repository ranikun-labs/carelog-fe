// upstream: finance-fe@7dd9590:src/components/ui/section-header.tsx (verbatim)
import * as React from 'react';

import { cn } from '@/lib/utils';

type SectionHeaderProps = Omit<React.ComponentProps<'div'>, 'title'> & {
  title: React.ReactNode;
  /** 제목 요소 수준. 문서 구조에 맞춰 호출부가 정한다(기본 h2). */
  headingLevel?: 2 | 3 | 4;
  /** 제목 우측 보조 행동(예: 전체 보기). */
  action?: React.ReactNode;
};

/** 카드 밖 섹션 제목(section-title 18/26). 제목 → 카드 간격은 호출부 레이아웃이 정한다. */
function SectionHeader({
  title,
  headingLevel = 2,
  action,
  className,
  ...props
}: SectionHeaderProps) {
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  return (
    <div
      data-slot="section-header"
      className={cn('flex min-h-11 items-center justify-between gap-3', className)}
      {...props}
    >
      <Heading className="type-section-title text-foreground min-w-0">{title}</Heading>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export { SectionHeader };
