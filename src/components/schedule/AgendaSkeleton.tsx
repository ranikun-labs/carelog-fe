import { useTranslation } from '@/i18n/I18nContext';

export function AgendaSkeleton() {
  const { t } = useTranslation();
  return (
    <section aria-label={t('schedule.loadingLabel')} className="px-4 py-6">
      <div className="flex animate-pulse flex-col gap-3" aria-hidden="true">
        {[1, 2, 3].map((item) => (
          <div key={item} className="border-border-subtle flex min-h-20 gap-3 border-b px-1 py-3">
            <div className="bg-subtle h-4 w-14 rounded" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="bg-subtle h-4 w-2/3 rounded" />
              <div className="bg-subtle h-3 w-1/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
