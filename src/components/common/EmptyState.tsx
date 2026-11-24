import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

/** icon·title·description·선택적 action slot만 책임진다. 아이콘은 보조(secondary 색), 장식 면 없음. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      {icon && (
        <div aria-hidden="true" className="text-text-secondary">
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <p className="type-content-title text-foreground">{title}</p>
        {description && (
          <p className="type-supporting text-text-secondary max-w-prose">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
