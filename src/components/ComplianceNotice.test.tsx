import { render, screen } from '@testing-library/react';

import { ComplianceNotice } from '@/components/ComplianceNotice';
import { I18nProvider } from '@/i18n/I18nContext';

it.each([
  ['ko', '이 화면의 내용은 예시이며 실제 제품 정책으로 교체해야 합니다.'],
  ['en', 'This screen contains examples that must be replaced with your product policy.'],
] as const)('renders the %s notice', (locale, message) => {
  render(
    <I18nProvider locale={locale}>
      <ComplianceNotice />
    </I18nProvider>,
  );
  expect(screen.getByText(message)).toBeVisible();
});
