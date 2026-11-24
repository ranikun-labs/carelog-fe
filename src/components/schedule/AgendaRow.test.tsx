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

  it('puts the time first and states every status in text, badging only overdue and cancelled', () => {
    const cases: Array<{ event: CustomerEvent; label: string; badge: boolean; rail: string }> = [
      {
        event: {
          id: 'planned',
          customerId: 'customer-1',
          status: 'PLANNED',
          scheduledAt: '2026-08-12T09:00:00+09:00',
          descriptor: '예정 일정',
        },
        label: '예정',
        badge: false,
        rail: 'planned',
      },
      {
        event: {
          id: 'overdue',
          customerId: 'customer-1',
          status: 'PLANNED',
          scheduledAt: '2026-08-11T09:00:00+09:00',
          descriptor: '지난 일정',
        },
        label: '정리 필요',
        badge: true,
        rail: 'warning',
      },
      {
        event: {
          id: 'occurred',
          customerId: 'customer-1',
          status: 'OCCURRED',
          scheduledAt: '2026-08-11T10:00:00+09:00',
          occurredAt: '2026-08-11T10:45:00+09:00',
          descriptor: '기록된 상담',
        },
        label: '기록됨',
        badge: false,
        rail: 'neutral',
      },
      {
        event: {
          id: 'cancelled',
          customerId: 'customer-1',
          status: 'CANCELLED',
          scheduledAt: '2026-08-12T13:30:00+09:00',
          descriptor: '취소된 일정',
        },
        label: '취소됨',
        badge: true,
        rail: 'neutral',
      },
    ];

    for (const { event, label, badge, rail } of cases) {
      const { unmount } = renderRow(event);
      const row = document.querySelector('[data-agenda-row]') as HTMLElement;
      // 시각이 행의 첫 요소, 그 다음이 제목.
      const time = row.querySelector('time');
      const heading = row.querySelector('h3');
      expect(time).not.toBeNull();
      expect(
        time!.compareDocumentPosition(heading!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      // 상태는 항상 글자로 있고, 배지(data-slot=badge)는 정리 필요·취소됨에만.
      expect(screen.getAllByText(label)).toHaveLength(1);
      expect(row.querySelector('[data-slot="badge"]') !== null).toBe(badge);
      expect(row.querySelector('[data-agenda-rail]')).toHaveAttribute('data-agenda-rail', rail);
      unmount();
    }
  });

  it('shows the occurred title as plain heading text, not as a description badge', () => {
    renderRow({
      id: 'occurred',
      customerId: 'customer-1',
      status: 'OCCURRED',
      occurredAt: '2026-08-11T10:45:00+09:00',
      descriptor: '기록된 상담',
    });
    const row = document.querySelector('[data-agenda-row]') as HTMLElement;
    expect(row.querySelector('h3')).toHaveTextContent('기록된 상담');
    expect(row.querySelector('[data-slot="badge"]')).toBeNull();
  });

  it('keeps the event title as the button name and reads time and status as its description', () => {
    renderRow({
      id: 'planned',
      customerId: 'customer-1',
      status: 'PLANNED',
      scheduledAt: '2026-08-12T09:00:00+09:00',
      descriptor: '일정 제목',
    });
    const button = screen.getByRole('button', { name: '일정 상세 열기: 일정 제목' });
    expect(button).toHaveAccessibleDescription(/\d{1,2}:\d{2}.*예정/);
  });
});
