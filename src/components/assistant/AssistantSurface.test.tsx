import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import {
  createDeterministicAssistantAdapter,
  type AssistantAdapter,
} from '@/assistant/assistantAdapter';
import type { ResolvedAssistantContext } from '@/assistant/assistantTypes';
import { AssistantSurface } from '@/components/assistant/AssistantSurface';
import { I18nProvider } from '@/i18n/I18nContext';
import { landlordTenantScenario } from '@/fixtures/scenarios';

const customer = {
  ...landlordTenantScenario.customer,
  workspace: landlordTenantScenario.workspace,
  context: landlordTenantScenario.context,
  interaction: landlordTenantScenario.interaction,
};

const customerContext: ResolvedAssistantContext = {
  navigation: {
    context: { kind: 'customer', customerId: customer.id },
    returnTo: { kind: 'customer-detail', customerId: customer.id },
  },
  customer,
};

function renderSurface(
  adapter: AssistantAdapter | null = createDeterministicAssistantAdapter({ latencyMs: 0 }),
  onSaveCustomerMemo?: (memo: string) => unknown,
) {
  return render(
    <MemoryRouter>
      <I18nProvider locale="ko">
        <AssistantSurface
          context={customerContext}
          adapter={adapter}
          onBack={vi.fn()}
          onSaveCustomerMemo={onSaveCustomerMemo}
        />
      </I18nProvider>
    </MemoryRouter>,
  );
}

describe('Assistant surface', () => {
  it('starts with contextual suggested actions and a labelled free question', () => {
    renderSurface();

    expect(screen.getByRole('heading', { name: 'Assistant' })).toBeVisible();
    expect(screen.getByText('고객')).toBeVisible();
    expect(screen.getByText('박세입')).toBeVisible();
    expect(
      screen.getAllByRole('button', { name: /최근 흐름 정리|다음에 확인할 질문/ }).length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByLabelText('직접 질문')).toBeVisible();
    expect(screen.getByRole('button', { name: '질문 보내기' })).toBeDisabled();
  });

  it('does not fabricate a result without an explicitly injected adapter', () => {
    renderSurface(null);

    expect(screen.getByRole('status')).toHaveTextContent('예시 결과를 자동으로 표시하지 않습니다.');
    expect(screen.getByRole('button', { name: '최근 흐름 정리' })).toBeDisabled();
    expect(screen.queryByRole('heading', { name: '정리 결과' })).not.toBeInTheDocument();
  });

  it('moves from loading to a bounded fixture result and prevents duplicate requests', async () => {
    const request = vi.fn(() => new Promise<never>(() => undefined));
    renderSurface({ request });

    const action = screen.getByRole('button', { name: '최근 흐름 정리' });
    fireEvent.click(action);
    fireEvent.click(action);

    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('내용을 정리하는 중입니다…');
    expect(screen.getByRole('button', { name: '최근 흐름 정리' })).toBeDisabled();
  });

  it('keeps Customer state unchanged until an explicit memo save', async () => {
    const saveCustomerMemo = vi.fn(() => ({ id: customer.id }));
    renderSurface(undefined, saveCustomerMemo);

    fireEvent.click(screen.getByRole('button', { name: '최근 흐름 정리' }));
    await screen.findByRole('heading', { name: '정리 결과' });
    fireEvent.click(screen.getByRole('button', { name: '메모에 추가' }));

    const memo = screen.getByLabelText('고객 메모');
    fireEvent.change(memo, { target: { value: '사용자가 확인한 메모' } });
    expect(saveCustomerMemo).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '메모 저장' }));
    expect(saveCustomerMemo).toHaveBeenCalledTimes(1);
    expect(saveCustomerMemo).toHaveBeenCalledWith('사용자가 확인한 메모');
    await waitFor(() => expect(screen.getByRole('status')).toHaveFocus());
  });

  it('connects retry to the injected adapter and exposes error semantics', async () => {
    const request = vi
      .fn<AssistantAdapter['request']>()
      .mockRejectedValueOnce(new Error('fixture failure'))
      .mockResolvedValueOnce({ summary: '다시 정리했습니다.', nextSteps: [] });
    renderSurface({ request });

    fireEvent.click(screen.getByRole('button', { name: '최근 흐름 정리' }));
    expect(await screen.findByRole('alert')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await screen.findByRole('heading', { name: '정리 결과' });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('keeps the memo editor open when the canonical save rejects', async () => {
    const saveCustomerMemo = vi
      .fn()
      .mockRejectedValueOnce(new Error('memo save failed'))
      .mockResolvedValueOnce({ id: customer.id });
    renderSurface(undefined, saveCustomerMemo);

    fireEvent.click(screen.getByRole('button', { name: '최근 흐름 정리' }));
    await screen.findByRole('heading', { name: '정리 결과' });
    fireEvent.click(screen.getByRole('button', { name: '메모에 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '메모 저장' }));

    expect(
      await screen.findByText('메모를 저장하지 못했습니다. 다시 시도해 주세요.'),
    ).toBeVisible();
    expect(screen.getByRole('button', { name: '메모 저장' })).toBeVisible();
    expect(screen.queryByText('고객 메모를 저장했습니다.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '메모 저장' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveFocus());
    expect(saveCustomerMemo).toHaveBeenCalledTimes(2);
  });
});
