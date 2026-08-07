import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

interface PageHeaderProps {
  title: ReactNode;
  backLabel: string;
  onBack?: () => void;
  trailing?: ReactNode;
}

/**
 * 뒤로가기·제목·선택적 trailing action만 책임진다. route path, 페이지명,
 * i18n key, history 호출은 호출부 책임이다 — `onBack`이 없으면 뒤로가기
 * 버튼 자체를 렌더하지 않는다.
 */
export function PageHeader({ title, backLabel, onBack, trailing }: PageHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 px-2">
      {onBack && (
        <Button variant="ghost" size="icon" aria-label={backLabel} onClick={onBack}>
          ←
        </Button>
      )}
      <h1 className="text-foreground flex-1 truncate text-base font-semibold">{title}</h1>
      {trailing}
    </header>
  );
}
