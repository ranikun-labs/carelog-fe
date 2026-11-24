import { useTranslation } from '@/i18n/I18nContext';

/** 로딩 자리. DateSection과 같은 카드·행 골격이라 불러온 뒤 레이아웃이 튀지 않는다. */
export function AgendaSkeleton() {
  const { t } = useTranslation();
  return (
    <section
      role="status"
      aria-busy="true"
      aria-label={t('schedule.loadingLabel')}
      className="px-4 pt-4 pb-6 md:px-6"
    >
      <div className="bg-inset rounded-card divide-card divide-y p-1" aria-hidden="true">
        {[1, 2, 3].map((item) => (
          <div key={item} className="flex min-h-20 gap-3 px-5 py-3 motion-safe:animate-pulse">
            <div className="bg-control rounded-badge h-5 w-[4.75rem] shrink-0" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="bg-control rounded-badge h-5 w-2/3" />
              <div className="bg-control rounded-badge h-4 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
