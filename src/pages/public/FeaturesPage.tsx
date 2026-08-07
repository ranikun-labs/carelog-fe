import { Card, CardContent } from '@/components/ui/card';
import { getMessages } from '@/i18n/dictionary';
import { useTranslation } from '@/i18n/I18nContext';

export function FeaturesPage() {
  const { locale, t } = useTranslation();
  const items = getMessages(locale).public.features.items;
  return (
    <main className="mx-auto max-w-5xl px-5 py-20">
      <h1 className="text-4xl font-bold">{t('public.features.title')}</h1>
      <p className="text-text-secondary mt-4">{t('public.features.description')}</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <Card key={item}>
            <CardContent className="p-6 font-medium">{item}</CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
