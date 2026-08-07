import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

/** icon·title·description·선택적 action slot만 책임진다. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      {icon && <div aria-hidden="true">{icon}</div>}
      <div className="flex flex-col gap-1.5">
        <p className="text-foreground text-base font-semibold">{title}</p>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}
