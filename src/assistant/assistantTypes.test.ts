import { describe, expect, it } from 'vitest';

import {
  readAssistantNavigationState,
  resolveAssistantContext,
  type AssistantNavigationState,
} from '@/assistant/assistantTypes';
import type { CustomerEvent } from '@/domain/customerEvent';
import { landlordTenantScenario } from '@/fixtures/scenarios';

const customer = {
  ...landlordTenantScenario.customer,
  workspace: landlordTenantScenario.workspace,
  context: landlordTenantScenario.context,
  interaction: landlordTenantScenario.interaction,
};

const plannedEvent: CustomerEvent = {
  id: 'planned-event',
  customerId: customer.id,
  status: 'PLANNED',
  scheduledAt: '2026-08-21T14:00:00+09:00',
};

const occurredEvent: CustomerEvent = {
  id: 'occurred-event',
  customerId: customer.id,
  status: 'OCCURRED',
  occurredAt: '2026-08-11T14:00:00+09:00',
};

describe('Assistant context resolution', () => {
  it('parses ID-only navigation and resolves the canonical Customer record', () => {
    const navigation = readAssistantNavigationState({
      context: { kind: 'customer', customerId: customer.id },
      returnTo: { kind: 'customer-detail', customerId: customer.id },
    });

    expect(navigation).toEqual({
      context: { kind: 'customer', customerId: customer.id },
      returnTo: { kind: 'customer-detail', customerId: customer.id },
    });
    expect(resolveAssistantContext(navigation!, [customer], [])?.customer).toBe(customer);
  });

  it.each([
    ['planned-event', plannedEvent],
    ['occurred-event', occurredEvent],
  ] as const)('resolves a %s only with its matching canonical Event status', (kind, event) => {
    const navigation: AssistantNavigationState = {
      context: {
        kind,
        customerId: customer.id,
        eventId: event.id,
      },
      returnTo: { kind: 'event-detail', customerId: customer.id, eventId: event.id },
    };

    const resolved = resolveAssistantContext(navigation, [customer], [event]);
    expect(resolved?.customer).toBe(customer);
    expect(resolved?.event).toBe(event);
  });

  it('rejects a cancelled Event and mismatched Customer identity without inventing context', () => {
    const cancelled: CustomerEvent = {
      id: 'cancelled-event',
      customerId: customer.id,
      status: 'CANCELLED',
      scheduledAt: plannedEvent.scheduledAt,
    };
    const navigation: AssistantNavigationState = {
      context: {
        kind: 'planned-event',
        customerId: customer.id,
        eventId: cancelled.id,
      },
      returnTo: { kind: 'event-detail', customerId: customer.id, eventId: cancelled.id },
    };

    expect(resolveAssistantContext(navigation, [customer], [cancelled])).toBeUndefined();
    expect(resolveAssistantContext(navigation, [customer], [plannedEvent])).toBeUndefined();
    expect(readAssistantNavigationState({ context: { kind: 'customer' } })).toBeUndefined();
  });
});
