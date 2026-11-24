import { ChevronLeft } from 'lucide-react';
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
 * 버튼 자체를 렌더하지 않는다. 제목은 page-title 역할(22/32), 뒤로가기는 터치 44의 neutral 아이콘.
 */
export function PageHeader({ title, backLabel, onBack, trailing }: PageHeaderProps) {
  return (
    <header className="flex min-h-14 shrink-0 items-center gap-1 px-2">
      {onBack && (
        <Button variant="text-neutral" size="icon" aria-label={backLabel} onClick={onBack}>
          <ChevronLeft className="size-6" aria-hidden="true" />
        </Button>
      )}
      <h1 className="type-page-title text-foreground min-w-0 flex-1 truncate px-2">{title}</h1>
      {trailing}
    </header>
  );
}
