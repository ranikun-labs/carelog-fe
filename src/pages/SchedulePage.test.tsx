import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';

import type { CustomerEvent } from '@/domain/customerEvent';
import { I18nProvider } from '@/i18n/I18nContext';
import { SchedulePage } from '@/pages/SchedulePage';
import { CustomerStoreProvider } from '@/state/CustomerStoreContext';

const now = new Date('2026-08-11T12:00:00+09:00');
const customers = [{ id: 'customer-1', displayName: '박세입' }];
const events: CustomerEvent[] = [
  {
    id: 'past',
    customerId: 'customer-1',
    status: 'OCCURRED',
    occurredAt: '2026-08-10T10:00:00+09:00',
    descriptor: '지난 기록',
  },
  {
    id: 'today',
    customerId: 'customer-1',
    status: 'PLANNED',
    scheduledAt: '2026-08-11T09:00:00+09:00',
    descriptor: '오늘 일정',
  },
  {
    id: 'future',
    customerId: 'customer-1',
    status: 'CANCELLED',
    scheduledAt: '2026-08-12T10:00:00+09:00',
    descriptor: '미래 취소 일정',
  },
];

function renderPage(props: React.ComponentProps<typeof SchedulePage> = {}) {
  return render(
    <MemoryRouter initialEntries={['/app/schedule']}>
      <I18nProvider locale="ko">
        <CustomerStoreProvider>
          <Routes>
            <Route
              path="/app/schedule"
              element={
                <SchedulePage
                  {...props}
                  now={now}
                  customers={props.customers ?? customers}
                  events={props.events ?? events}
                />
              }
            />
            <Route path="/app/events/:eventId" element={<p>event detail route</p>} />
            <Route path="/app/customers/:customerId" element={<p>customer detail route</p>} />
          </Routes>
        </CustomerStoreProvider>
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('SchedulePage', () => {
  it('renders past, today, and future sections in agenda order', () => {
    renderPage();

    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['8월 10일 (월)', '8월 11일 (화) 오늘', '8월 12일 (수)']);
    expect(
      [...document.querySelectorAll<HTMLElement>('[data-agenda-row]')].map((row) =>
        row.getAttribute('data-event-id'),
      ),
    ).toEqual(['past', 'today', 'future']);
  });

  it('keeps the overdue cue conditional and selects the latest overdue date', () => {
    renderPage({
      events: [
        ...events,
        {
          id: 'overdue-latest',
          customerId: 'customer-1',
          status: 'PLANNED',
          scheduledAt: '2026-08-11T11:00:00+09:00',
          descriptor: '가장 최근 지난 일정',
        },
      ],
    });
    expect(screen.getByText('정리 필요한 일정 2개')).toBeVisible();
    expect(screen.getByText('가장 최근 지난 일정')).toBeVisible();
  });

  it('scrolls the overdue cue to the latest overdue row when dates contain multiple events', async () => {
    const scrollTargets: string[] = [];
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: function (this: HTMLElement) {
        scrollTargets.push(this.dataset.eventId ?? this.dataset.dateKey ?? '');
      },
    });

    try {
      renderPage({
        events: [
          {
            id: 'overdue-earlier',
            customerId: 'customer-1',
            status: 'PLANNED',
            scheduledAt: '2026-08-11T09:00:00+09:00',
            descriptor: '더 이른 지난 일정',
          },
          {
            id: 'overdue-latest',
            customerId: 'customer-1',
            status: 'PLANNED',
            scheduledAt: '2026-08-11T11:00:00+09:00',
            descriptor: '가장 최근 지난 일정',
          },
        ],
      });
      scrollTargets.length = 0;

      fireEvent.click(screen.getByRole('button', { name: '정리 필요한 일정 2개' }));

      await waitFor(() => expect(scrollTargets.at(-1)).toBe('overdue-latest'));
    } finally {
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
          configurable: true,
          value: originalScrollIntoView,
        });
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
      }
    }
  });

  describe('scroll spy initial-anchor guard', () => {
    // 첫 앵커 직후 글꼴·레이아웃이 자리 잡으며 scroll 이벤트가 한 번 더 나는 상황을 흉내 낸다.
    // 이 이벤트가 맨 아래 보정으로 마지막 날짜를 선택하면 오늘이 풀려 "오늘로 돌아가기"가 잘못 뜬다.
    const ANCHOR_TOP = 640;
    let originalScrollIntoView: typeof HTMLElement.prototype.scrollIntoView | undefined;
    let performanceNow: ReturnType<typeof vi.spyOn>;
    let clock = 10_000;

    beforeEach(() => {
      clock = 10_000;
      performanceNow = vi.spyOn(performance, 'now').mockImplementation(() => clock);
      originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: function (this: HTMLElement) {
          const surface = this.closest<HTMLElement>('[data-scroll-surface]');
          if (surface) surface.scrollTop = ANCHOR_TOP;
        },
      });
    });

    afterEach(() => {
      performanceNow.mockRestore();
      if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
          configurable: true,
          value: originalScrollIntoView,
        });
      } else {
        Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView');
      }
    });

    // 스크롤 한계에 닿은 상태: scrollTop + clientHeight >= scrollHeight - 1 → 맨 아래 보정이 작동하는 조건.
    // 앵커가 잡히는 렌더 시점에 이미 같은 높이가 보여야 "레이아웃 높이 변화"가 아니라 순수 스크롤 이동만 시험한다.
    const sizeOverrides = new Map<string, PropertyDescriptor | undefined>();
    function stubSurfaceSize(name: 'clientHeight' | 'scrollHeight', value: number) {
      if (!sizeOverrides.has(name)) {
        sizeOverrides.set(name, Object.getOwnPropertyDescriptor(Element.prototype, name));
      }
      Object.defineProperty(Element.prototype, name, {
        configurable: true,
        get(this: Element) {
          return this.hasAttribute('data-scroll-surface') ? value : 0;
        },
      });
    }
    afterEach(() => {
      for (const [name, descriptor] of sizeOverrides) {
        if (descriptor) Object.defineProperty(Element.prototype, name, descriptor);
        else Reflect.deleteProperty(Element.prototype, name);
      }
      sizeOverrides.clear();
    });

    function renderAnchored() {
      stubSurfaceSize('clientHeight', 400);
      stubSurfaceSize('scrollHeight', 1040);
      renderPage();
      return document.querySelector<HTMLElement>('[data-scroll-surface]')!;
    }

    const selectedDateKey = () =>
      document
        .querySelector<HTMLElement>('[data-week-strip] button[aria-current="date"]')
        ?.getAttribute('data-date-key');

    it('ignores the settling scroll event right after the first anchor', () => {
      const surface = renderAnchored();
      expect(selectedDateKey()).toBe('2026-08-11');

      // 첫 scroll 이벤트는 앵커 자체가 낸 것이라 기존 로직이 소비한다.
      fireEvent.scroll(surface);
      // 곧바로 한 번 더, 앵커 위치에서 2px 어긋난 채로 온다(레이아웃 안착).
      clock += 200;
      surface.scrollTop = ANCHOR_TOP + 2;
      fireEvent.scroll(surface);

      expect(selectedDateKey()).toBe('2026-08-11');
    });

    it('still follows the user once the scroll moves beyond the anchor tolerance', () => {
      const surface = renderAnchored();
      fireEvent.scroll(surface);

      clock += 200;
      surface.scrollTop = ANCHOR_TOP + 5;
      fireEvent.scroll(surface);

      expect(selectedDateKey()).toBe('2026-08-12');
    });

    it('treats a scroll that comes with a layout height change as settling, not as the user', () => {
      const surface = renderAnchored();
      fireEvent.scroll(surface);

      // 글꼴·스켈레톤이 자리 잡아 스크롤 높이가 줄고 위치도 4px보다 크게 밀린다(375x856 재현 조건).
      clock += 200;
      stubSurfaceSize('scrollHeight', 1000);
      surface.scrollTop = ANCHOR_TOP + 20;
      fireEvent.scroll(surface);

      expect(selectedDateKey()).toBe('2026-08-11');
    });

    it('stops ignoring scroll events after the one-second settling window', () => {
      const surface = renderAnchored();
      fireEvent.scroll(surface);

      clock += 1000;
      surface.scrollTop = ANCHOR_TOP + 2;
      fireEvent.scroll(surface);

      expect(selectedDateKey()).toBe('2026-08-12');
    });
  });

  it('separates empty and error states while keeping the navigation baseline', () => {
    const { unmount } = renderPage({ events: [], customers });
    expect(screen.getByText('아직 일정이 없습니다')).toBeVisible();
    expect(screen.getByRole('link', { name: '고객 보기' })).toHaveAttribute(
      'href',
      '/app/customers',
    );
    expect(screen.queryByText('일정을 불러오지 못했습니다')).not.toBeInTheDocument();
    unmount();

    renderPage({ loadState: 'error' });
    expect(screen.getByText('일정을 불러오지 못했습니다')).toBeVisible();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeVisible();
    expect(screen.queryByText('아직 일정이 없습니다')).not.toBeInTheDocument();
  });

  it('routes Customer=0 to the first-customer flow instead of the event-empty contract', () => {
    renderPage({ events: [], customers: [] });

    expect(screen.getByText('먼저 고객을 추가해 주세요')).toBeVisible();
    const firstCustomerCta = screen.getByRole('link', { name: '첫 고객 추가' });
    expect(firstCustomerCta).toHaveAttribute('href', '/app/customers/new');
    expect(firstCustomerCta).toHaveClass('bg-primary', 'min-h-(--control-h)');
    expect(screen.queryByText('아직 일정이 없습니다')).not.toBeInTheDocument();
  });

  it('opens Event Detail from a row and Customer Detail from the customer target', () => {
    renderPage();
    const row = screen.getByRole('button', { name: '일정 상세 열기: 오늘 일정' });
    fireEvent.click(row);
    expect(screen.getByText('event detail route')).toBeVisible();
  });
});
