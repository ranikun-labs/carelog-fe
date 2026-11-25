import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

import { EventDetail } from '@/components/schedule/EventDetail';
import { toCanonicalTimestamp, toDateTimeLocalValue } from '@/components/schedule/EventForm';
import type { CustomerEvent } from '@/domain/customerEvent';
import { I18nProvider } from '@/i18n/I18nContext';

const now = new Date('2026-08-11T12:00:00+09:00');

function renderDetail(
  event: CustomerEvent,
  onOccurEvent?: (occurredAt: string) => CustomerEvent | undefined,
) {
  return render(
    <MemoryRouter>
      <I18nProvider locale="ko">
        <EventDetail
          event={event}
          customerName="박세입"
          customerPath="/app/customers/customer-1"
          now={now}
          onOccurEvent={onOccurEvent}
        />
      </I18nProvider>
    </MemoryRouter>,
  );
}

function getTimeTexts() {
  return [...document.querySelectorAll('time')].map((time) => time.textContent ?? '');
}

describe('EventDetail', () => {
  it('opens the occurrence confirmation at start when entered from the customer record action', () => {
    render(
      <MemoryRouter>
        <I18nProvider locale="ko">
          <EventDetail
            event={{
              id: 'overdue',
              customerId: 'customer-1',
              status: 'PLANNED',
              scheduledAt: '2026-08-11T09:30:00+09:00',
            }}
            customerName="박세입"
            customerPath="/app/customers/customer-1"
            now={now}
            onOccurEvent={vi.fn()}
            startWithOccurrenceConfirmation
          />
        </I18nProvider>
      </MemoryRouter>,
    );
    expect(document.querySelector('[data-event-occurrence-confirmation]')).not.toBeNull();
    expect(screen.getByLabelText(/실제/)).toHaveFocus();
  });

  it.each(['2026-08-12T09:00:00+09:00', '2026-08-11T09:00:00+09:00'])(
    'returns focus to the occurrence trigger after closing confirmation for %s',
    (scheduledAt) => {
      const onOccurEvent = vi.fn();
      renderDetail(
        { id: 'focus-event', customerId: 'customer-1', status: 'PLANNED', scheduledAt },
        onOccurEvent,
      );
      const trigger = screen.getByRole('button', { name: '기록 완료' });
      trigger.focus();
      fireEvent.click(trigger);
      const close = screen.getByRole('button', { name: '닫기' });
      close.focus();
      expect(close).toHaveFocus();
      fireEvent.click(close);
      expect(document.querySelector('[data-event-occurrence-confirmation]')).toBeNull();
      expect(trigger).toHaveFocus();
      expect(onOccurEvent).not.toHaveBeenCalled();
    },
  );

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

  it('confirms the scheduled time by default and allows an actual-time override before mutation', () => {
    const plannedEvent: CustomerEvent = {
      id: 'planned-transition',
      customerId: 'customer-1',
      status: 'PLANNED',
      scheduledAt: '2026-08-15T10:00:00+09:00',
      descriptor: '예정 상담',
    };
    const onOccurEvent = vi.fn((occurredAt: string) => ({
      ...plannedEvent,
      status: 'OCCURRED' as const,
      occurredAt,
    }));

    renderDetail(plannedEvent, onOccurEvent);

    fireEvent.click(screen.getByRole('button', { name: '기록 완료' }));
    const occurrenceInput = screen.getByLabelText('실제');
    expect(occurrenceInput).toHaveValue(toDateTimeLocalValue(plannedEvent.scheduledAt));
    expect(onOccurEvent).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(document.querySelector('[data-event-occurrence-confirmation]')).not.toBeInTheDocument();
    expect(onOccurEvent).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '기록 완료' }));
    fireEvent.change(screen.getByLabelText('실제'), {
      target: { value: '2026-08-16T09:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    expect(onOccurEvent).toHaveBeenCalledWith(toCanonicalTimestamp('2026-08-16T09:00'));
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

  describe('action emphasis and Key Block', () => {
    function renderWithActions(event: CustomerEvent) {
      return render(
        <MemoryRouter>
          <I18nProvider locale="ko">
            <EventDetail
              event={event}
              customerName="박세입"
              customerPath="/app/customers/customer-1"
              now={now}
              onOccurEvent={vi.fn()}
              onCancelEvent={vi.fn()}
              onEdit={vi.fn()}
              onOpenAssistant={vi.fn()}
            />
          </I18nProvider>
        </MemoryRouter>,
      );
    }

    const strongButtons = () =>
      screen.queryAllByRole('button').filter((button) => button.className.includes('bg-primary'));

    it('uses the only Strong on the overdue record action and moves it into the confirmation panel', () => {
      renderWithActions({
        id: 'overdue',
        customerId: 'customer-1',
        status: 'PLANNED',
        scheduledAt: '2026-08-11T09:00:00+09:00',
        descriptor: '지난 상담',
      });
      expect(strongButtons().map((button) => button.textContent)).toEqual(['기록 완료']);

      fireEvent.click(screen.getByRole('button', { name: '기록 완료' }));
      // 패널이 열리면 Strong은 "확인" 하나뿐이고, 첫 입력(실제 시각)이 포커스를 받는다.
      expect(strongButtons().map((button) => button.textContent)).toEqual(['확인']);
      expect(screen.getByLabelText('실제')).toHaveFocus();
    });

    it('keeps Strong at zero for upcoming, recorded and cancelled events', () => {
      const { unmount } = renderWithActions({
        id: 'upcoming',
        customerId: 'customer-1',
        status: 'PLANNED',
        scheduledAt: '2026-08-15T10:00:00+09:00',
        descriptor: '예정 상담',
      });
      expect(strongButtons()).toHaveLength(0);
      unmount();

      const { unmount: unmountRecorded } = renderWithActions({
        id: 'recorded',
        customerId: 'customer-1',
        status: 'OCCURRED',
        occurredAt: '2026-08-11T10:00:00+09:00',
        descriptor: '기록된 상담',
      });
      expect(strongButtons()).toHaveLength(0);
      unmountRecorded();

      renderWithActions({
        id: 'cancelled',
        customerId: 'customer-1',
        status: 'CANCELLED',
        scheduledAt: '2026-08-12T09:00:00+09:00',
        descriptor: '취소된 일정',
      });
      expect(strongButtons()).toHaveLength(0);
    });

    it('has one key-value time, no bordered card, and keeps both times when they differ', () => {
      renderDetail({
        id: 'different',
        customerId: 'customer-1',
        status: 'OCCURRED',
        scheduledAt: '2026-08-11T10:00:00+09:00',
        occurredAt: '2026-08-11T10:30:00+09:00',
      });
      const article = document.querySelector('[data-event-detail]') as HTMLElement;
      expect(article.querySelectorAll('.type-key-value')).toHaveLength(1);
      // Key는 실제(기록) 시각이다 — 시간대와 무관하게 dateTime으로 확인한다.
      expect(article.querySelector('.type-key-value time')).toHaveAttribute(
        'datetime',
        '2026-08-11T10:30:00+09:00',
      );
      expect(article.innerHTML).not.toMatch(/\bborder\b/);
      expect(getTimeTexts()).toHaveLength(2);
    });
  });
});
