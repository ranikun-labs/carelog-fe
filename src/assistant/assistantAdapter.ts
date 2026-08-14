import type { AssistantContext } from '@/assistant/assistantTypes';

export interface AssistantRequest {
  context: AssistantContext;
  question: string;
  suggestedActionId?: string;
}

export interface AssistantResult {
  summary: string;
  nextSteps: readonly string[];
}

export interface AssistantAdapter {
  request: (input: AssistantRequest) => Promise<AssistantResult>;
}

export interface DeterministicAssistantAdapterOptions {
  latencyMs?: number;
  scenario?: 'success' | 'error' | 'retry-success';
}

const FIXTURE_RESULTS: Record<AssistantContext['kind'], AssistantResult> = {
  customer: {
    summary: '최근 상담에서 일정 변경 이야기가 반복됐습니다.',
    nextSteps: ['일정 변경 이유 확인', '다음 방문 가능 시간 확인', '이전 요청사항 진행 여부 확인'],
  },
  'planned-event': {
    summary: '예정된 일정에 앞서 최근 기록과 확인할 내용을 정리했습니다.',
    nextSteps: ['지난 요청사항 확인', '이번 일정에서 확인할 질문 정리', '다음 단계 기록 준비'],
  },
  'occurred-event': {
    summary: '기록된 일정에서 다음에 이어갈 내용을 간단히 정리했습니다.',
    nextSteps: ['합의된 내용 다시 확인', '남은 질문 정리', '후속 일정 필요 여부 확인'],
  },
};

export function createDeterministicAssistantAdapter(
  options: DeterministicAssistantAdapterOptions = {},
): AssistantAdapter {
  const latencyMs = Math.max(0, Math.floor(options.latencyMs ?? 220));
  const scenario = options.scenario ?? 'success';
  let requestCount = 0;

  return {
    request: ({ context }) =>
      new Promise<AssistantResult>((resolve, reject) => {
        setTimeout(() => {
          requestCount += 1;
          const shouldFail =
            scenario === 'error' || (scenario === 'retry-success' && requestCount === 1);
          if (shouldFail) {
            reject(new Error('Deterministic assistant fixture failed.'));
            return;
          }
          resolve(FIXTURE_RESULTS[context.kind]);
        }, latencyMs);
      }),
  };
}
