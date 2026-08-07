import { Link } from 'react-router';

import { Card, CardContent } from '@/components/ui/card';
import { buildAppItemDetailPath } from '@/constants/routes';
import { getMessages } from '@/i18n/dictionary';
import { useTranslation } from '@/i18n/I18nContext';

const IDS = ['sample workspace', 'check/checklist', 'starter-task'] as const;

export function ItemsPage() {
  const { locale, t } = useTranslation();
  const names = getMessages(locale).items.sampleNames;
  return (
    <main className="p-6 pt-10">
      <h1 className="text-3xl font-bold">{t('items.title')}</h1>
      <p className="text-text-secondary mt-2">{t('items.description')}</p>
      <ul className="mt-8 space-y-3">
        {IDS.map((id, index) => (
          <li key={id}>
            <Card>
              <CardContent className="p-0">
                <Link
                  className="flex min-h-14 items-center px-5 font-medium focus-visible:outline-2"
                  to={buildAppItemDetailPath(id)}
                >
                  {names[index]}
                </Link>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
