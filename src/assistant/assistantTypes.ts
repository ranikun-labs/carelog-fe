import type { CustomerEvent } from '@/domain/customerEvent';
import type { CustomerRecord } from '@/types/customer';

export type AssistantEntryContext = 'customer' | 'planned-event' | 'occurred-event';

export type AssistantContext =
  | {
      kind: 'customer';
      customerId: string;
    }
  | {
      kind: 'planned-event' | 'occurred-event';
      customerId: string;
      eventId: string;
    };

export type AssistantReturnTarget =
  | {
      kind: 'customer-detail';
      customerId: string;
    }
  | {
      kind: 'event-detail';
      customerId: string;
      eventId: string;
    };

export interface AssistantNavigationState {
  context: AssistantContext;
  returnTo: AssistantReturnTarget;
}

export interface ResolvedAssistantContext {
  navigation: AssistantNavigationState;
  customer: CustomerRecord;
  event?: CustomerEvent;
}

function readAssistantContext(value: unknown): AssistantContext | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const state = value as Record<string, unknown>;
  const kind = state.kind;
  const customerId = state.customerId;
  if (typeof customerId !== 'string' || customerId.length === 0) return undefined;

  if (kind === 'customer') return { kind, customerId };
  if (kind !== 'planned-event' && kind !== 'occurred-event') return undefined;
  if (typeof state.eventId !== 'string' || state.eventId.length === 0) return undefined;
  return { kind, customerId, eventId: state.eventId };
}

function readAssistantReturnTarget(value: unknown): AssistantReturnTarget | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const state = value as Record<string, unknown>;
  const customerId = state.customerId;
  if (typeof customerId !== 'string' || customerId.length === 0) return undefined;

  if (state.kind === 'customer-detail') return { kind: state.kind, customerId };
  if (state.kind !== 'event-detail') return undefined;
  if (typeof state.eventId !== 'string' || state.eventId.length === 0) return undefined;
  return { kind: state.kind, customerId, eventId: state.eventId };
}

export function readAssistantNavigationState(value: unknown): AssistantNavigationState | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const state = value as Record<string, unknown>;
  const context = readAssistantContext(state.context);
  const returnTo = readAssistantReturnTarget(state.returnTo);
  if (!context || !returnTo) return undefined;
  return { context, returnTo };
}

export function getAssistantContextKey(context: AssistantContext): string {
  return context.kind === 'customer'
    ? `${context.kind}:${context.customerId}`
    : `${context.kind}:${context.customerId}:${context.eventId}`;
}

export function resolveAssistantContext(
  navigation: AssistantNavigationState,
  customers: readonly CustomerRecord[],
  events: readonly CustomerEvent[],
): ResolvedAssistantContext | undefined {
  const customer = customers.find((candidate) => candidate.id === navigation.context.customerId);
  if (!customer) return undefined;

  if (navigation.context.kind === 'customer') {
    return { navigation, customer };
  }

  const eventContext = navigation.context;
  const event = events.find((candidate) => candidate.id === eventContext.eventId);
  if (!event || event.customerId !== customer.id) return undefined;
  if (eventContext.kind === 'planned-event' && event.status !== 'PLANNED') return undefined;
  if (eventContext.kind === 'occurred-event' && event.status !== 'OCCURRED') return undefined;
  return { navigation, customer, event };
}
