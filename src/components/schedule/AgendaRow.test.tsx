import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { AgendaRow } from '@/components/schedule/AgendaRow';
import type { CustomerEvent } from '@/domain/customerEvent';
import { I18nProvider } from '@/i18n/I18nContext';

const now = new Date('2026-08-11T12:00:00+09:00');

function renderRow(event: CustomerEvent) {
  const onOpen = vi.fn();
  const view = render(
    <MemoryRouter initialEntries={['/app/schedule']}>
      <I18nProvider locale="ko">
        <Routes>
          <Route
            path="/app/schedule"
            element={<AgendaRow event={event} customerName="박세입" now={now} onOpen={onOpen} />}
          />
          <Route path="/app/customers/:customerId" element={<p>customer detail</p>} />
        </Routes>
      </I18nProvider>
    </MemoryRouter>,
  );
  return { onOpen, unmount: view.unmount };
}

describe('AgendaRow', () => {
  it('opens Event Detail from the row while keeping Customer as a separate target', () => {
    const { onOpen } = renderRow({
      id: 'planned-1',
      customerId: 'customer-1',
      status: 'PLANNED',
      scheduledAt: '2026-08-12T09:00:00+09:00',
      descriptor: '일정 제목',
    });

    fireEvent.click(screen.getByRole('button', { name: '일정 상세 열기: 일정 제목' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'planned-1', status: 'PLANNED' }),
    );

    fireEvent.click(screen.getByRole('link', { name: '박세입' }));
    expect(screen.getByText('customer detail')).toBeVisible();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('does not badge a normal planned row and uses the overdue grammar when needed', () => {
    const { unmount } = renderRow({
      id: 'normal-planned',
      customerId: 'customer-1',
      status: 'PLANNED',
      scheduledAt: '2026-08-12T09:00:00+09:00',
      descriptor: '예정 일정',
    });
    expect(screen.queryByText('정리 필요')).not.toBeInTheDocument();
    expect(screen.getByText('예정')).toBeVisible();
    unmount();

    renderRow({
      id: 'overdue-planned',
      customerId: 'customer-1',
      status: 'PLANNED',
      scheduledAt: '2026-08-11T09:00:00+09:00',
      descriptor: '지난 일정',
    });
    expect(screen.getByText('정리 필요')).toBeVisible();
    expect(screen.getByText('예정 시각 지남')).toBeVisible();
  });
});
