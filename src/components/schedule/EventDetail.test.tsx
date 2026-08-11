import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

import { EventDetail } from '@/components/schedule/EventDetail';
import type { CustomerEvent } from '@/domain/customerEvent';
import { I18nProvider } from '@/i18n/I18nContext';

const now = new Date('2026-08-11T12:00:00+09:00');

function renderDetail(event: CustomerEvent) {
  return render(
    <MemoryRouter>
      <I18nProvider locale="ko">
        <EventDetail
          event={event}
          customerName="박세입"
          customerPath="/app/customers/customer-1"
          now={now}
        />
      </I18nProvider>
    </MemoryRouter>,
  );
}

function getTimeTexts() {
  return [...document.querySelectorAll('time')].map((time) => time.textContent ?? '');
}

describe('EventDetail', () => {
  it('renders normal and overdue planned states without mutation controls', () => {
    const { unmount } = renderDetail({
      id: 'planned',
      customerId: 'customer-1',
      status: 'PLANNED',
      scheduledAt: '2026-08-12T09:00:00+09:00',
      descriptor: '예정 상담',
      note: '메모 내용',
    });
    expect(screen.getAllByText('예정')).toHaveLength(2);
    expect(screen.getByText('메모 내용')).toBeVisible();
    expect(getTimeTexts()[0]).toContain('8월 12일');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    unmount();

    renderDetail({
      id: 'overdue',
      customerId: 'customer-1',
      status: 'PLANNED',
      scheduledAt: '2026-08-11T09:00:00+09:00',
      descriptor: '지난 상담',
    });
    expect(screen.getByText('정리 필요')).toBeVisible();
    expect(screen.getByText('예정 시각 지남')).toBeVisible();
    expect(getTimeTexts()[0]).toContain('8월 11일');
  });

  it('renders an immediate occurred event with one actual time', () => {
    renderDetail({
      id: 'immediate',
      customerId: 'customer-1',
      status: 'OCCURRED',
      occurredAt: '2026-08-11T10:00:00+09:00',
      descriptor: '기록된 상담',
    });

    expect(screen.getByText('기록된 상담')).toBeVisible();
    expect(screen.getByText('실제')).toBeVisible();
    expect(getTimeTexts()).toHaveLength(1);
    expect(getTimeTexts()[0]).toContain('8월 11일');
    expect(screen.queryByText('예정')).not.toBeInTheDocument();
  });

  it('avoids duplicate time when a transitioned event kept the same instant and separates different instants', () => {
    const { unmount } = renderDetail({
      id: 'same-time',
      customerId: 'customer-1',
      status: 'OCCURRED',
      scheduledAt: '2026-08-11T10:00:00+09:00',
      occurredAt: '2026-08-11T01:00:00Z',
    });
    expect(screen.getByText('시간')).toBeVisible();
    expect(screen.queryByText('실제')).not.toBeInTheDocument();
    expect(getTimeTexts()).toHaveLength(1);
    expect(getTimeTexts()[0]).toContain('8월 11일');
    unmount();

    const { unmount: unmountDifferentTime } = renderDetail({
      id: 'different-time',
      customerId: 'customer-1',
      status: 'OCCURRED',
      scheduledAt: '2026-08-11T10:00:00+09:00',
      occurredAt: '2026-08-11T10:30:00+09:00',
    });
    expect(screen.getByText('예정')).toBeVisible();
    expect(screen.getByText('실제')).toBeVisible();
    expect(getTimeTexts()).toHaveLength(2);
    expect(getTimeTexts()[0]).toContain('8월 11일');
    expect(getTimeTexts()[1]).toContain('8월 11일');
    unmountDifferentTime();

    renderDetail({
      id: 'different-date',
      customerId: 'customer-1',
      status: 'OCCURRED',
      scheduledAt: '2026-08-11T10:00:00+09:00',
      occurredAt: '2026-08-12T10:00:00+09:00',
    });
    expect(screen.getByText('예정')).toBeVisible();
    expect(screen.getByText('실제')).toBeVisible();
    expect(getTimeTexts()).toEqual([
      expect.stringContaining('8월 11일'),
      expect.stringContaining('8월 12일'),
    ]);
  });

  it('keeps the cancelled event at its scheduled time without an occurred time', () => {
    renderDetail({
      id: 'cancelled',
      customerId: 'customer-1',
      status: 'CANCELLED',
      scheduledAt: '2026-08-12T09:00:00+09:00',
      descriptor: '취소된 일정',
    });

    expect(screen.getByText('취소됨')).toBeVisible();
    expect(screen.getByText('예정')).toBeVisible();
    expect(getTimeTexts()).toHaveLength(1);
    expect(getTimeTexts()[0]).toContain('8월 12일');
    expect(screen.queryByText('실제')).not.toBeInTheDocument();
  });
});
