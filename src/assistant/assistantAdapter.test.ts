import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDeterministicAssistantAdapter } from '@/assistant/assistantAdapter';

afterEach(() => {
  vi.useRealTimers();
});

describe('deterministic Assistant adapter', () => {
  it('returns a bounded fixture after the configured mock latency', async () => {
    vi.useFakeTimers();
    const adapter = createDeterministicAssistantAdapter({ latencyMs: 20 });
    const request = adapter.request({
      context: { kind: 'planned-event', customerId: 'customer-1', eventId: 'event-1' },
      question: '예정된 일정을 준비해 줘',
    });

    await vi.advanceTimersByTimeAsync(20);
    await expect(request).resolves.toEqual({
      summary: '예정된 일정에 앞서 최근 기록과 확인할 내용을 정리했습니다.',
      nextSteps: ['지난 요청사항 확인', '이번 일정에서 확인할 질문 정리', '다음 단계 기록 준비'],
    });
  });

  it('keeps an error scenario deterministic and supports a real retry-success attempt', async () => {
    vi.useFakeTimers();
    const adapter = createDeterministicAssistantAdapter({
      latencyMs: 5,
      scenario: 'retry-success',
    });
    const input = {
      context: { kind: 'occurred-event' as const, customerId: 'customer-1', eventId: 'event-1' },
      question: '기록을 정리해 줘',
    };

    const first = adapter.request(input);
    const firstExpectation = expect(first).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(5);
    await firstExpectation;

    const second = adapter.request(input);
    const secondExpectation = expect(second).resolves.toMatchObject({
      summary: '기록된 일정에서 다음에 이어갈 내용을 간단히 정리했습니다.',
    });
    await vi.advanceTimersByTimeAsync(5);
    await secondExpectation;
  });
});
