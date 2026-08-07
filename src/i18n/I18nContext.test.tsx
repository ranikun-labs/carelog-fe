import { render, waitFor } from '@testing-library/react';

import { I18nProvider } from '@/i18n/I18nContext';

it('synchronizes the html lang attribute', async () => {
  const { rerender } = render(<I18nProvider locale="ko">content</I18nProvider>);
  await waitFor(() => expect(document.documentElement.lang).toBe('ko'));
  rerender(<I18nProvider locale="en">content</I18nProvider>);
  await waitFor(() => expect(document.documentElement.lang).toBe('en'));
});
