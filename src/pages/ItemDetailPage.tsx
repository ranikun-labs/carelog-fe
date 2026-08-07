import { Link, useParams } from 'react-router';

import { buildAppItemsPath } from '@/constants/routes';
import { getMessages } from '@/i18n/dictionary';
import { useTranslation } from '@/i18n/I18nContext';

export function ItemDetailPage() {
  const { id = '' } = useParams();
  const { locale, t } = useTranslation();
  const steps = getMessages(locale).items.detail.steps;
  return (
    <main className="min-h-full p-6 pt-10">
      <h1 className="text-3xl font-bold">{t('items.detail.title')}</h1>
      <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="font-medium">{t('items.detail.identifier')}</dt>
        <dd className="break-all">{id}</dd>
        <dt className="font-medium">{t('items.detail.created')}</dt>
        <dd>
          <time dateTime="2026-01-01">2026-01-01</time>
        </dd>
      </dl>
      <h2 className="mt-8 text-xl font-semibold">{t('items.detail.checklist')}</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ul>
      <Link
        className="text-primary mt-10 inline-block min-h-11 py-3 underline"
        to={buildAppItemsPath()}
      >
        {t('items.detail.back')}
      </Link>
    </main>
  );
}
