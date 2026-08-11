import { Link } from 'react-router';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { buildAppCustomerDetailPath } from '@/constants/routes';
import type { ScenarioFixture } from '@/fixtures/scenarios';
import { useTranslation } from '@/i18n/I18nContext';
import { cn, formatDate } from '@/lib/utils';

interface CustomerCardProps {
  scenario: ScenarioFixture;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function CustomerCard({ scenario, isSelected = false, onSelect }: CustomerCardProps) {
  const { t } = useTranslation();
  const { customer, workspace, context, interaction } = scenario;
  return (
    <Card>
      <CardContent className="p-0">
        <Link
          className={cn(
            'flex flex-col gap-2 p-4 focus-visible:outline-2',
            isSelected && 'bg-accent-primary-bg',
          )}
          to={buildAppCustomerDetailPath(customer.id)}
          aria-current={isSelected ? 'true' : undefined}
          onClick={(event) => {
            if (!onSelect) return;
            event.preventDefault();
            onSelect();
          }}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">{customer.displayName}</span>
            <Badge tone="info">{workspace.name}</Badge>
          </div>
          <p className="text-text-secondary text-sm">
            {t('customers.recentContact')}:{' '}
            <time dateTime={interaction.occurredAt}>{formatDate(interaction.occurredAt)}</time>
          </p>
          <p className="text-text-secondary line-clamp-1 text-sm">{context.summary}</p>
        </Link>
      </CardContent>
    </Card>
  );
}
