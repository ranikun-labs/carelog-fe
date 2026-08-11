import type { CustomerEvent } from '@/domain/customerEvent';
import type { FollowUp, TimelineEntry } from '@/types/customer';

export interface LegacyCustomerEventSources {
  timelineEntries: readonly TimelineEntry[];
  followUps: readonly FollowUp[];
}

export interface CompletedFollowUpUnmappedDiagnostic {
  code: 'COMPLETED_FOLLOW_UP_WITHOUT_OCCURRENCE_EVIDENCE';
  source: 'FollowUp';
  sourceId: string;
  customerId: string;
}

export interface LegacyCustomerEventAdapterResult {
  events: readonly CustomerEvent[];
  diagnostics: readonly CompletedFollowUpUnmappedDiagnostic[];
}

export function adaptLegacyCustomerEvents({
  timelineEntries,
  followUps,
}: LegacyCustomerEventSources): LegacyCustomerEventAdapterResult {
  const events: CustomerEvent[] = timelineEntries.map((entry) => ({
    id: entry.id,
    customerId: entry.customerId,
    status: 'OCCURRED',
    occurredAt: entry.occurredAt,
    descriptor: entry.label,
  }));
  const diagnostics: CompletedFollowUpUnmappedDiagnostic[] = [];

  for (const followUp of followUps) {
    if (followUp.done) {
      diagnostics.push({
        code: 'COMPLETED_FOLLOW_UP_WITHOUT_OCCURRENCE_EVIDENCE',
        source: 'FollowUp',
        sourceId: followUp.id,
        customerId: followUp.customerId,
      });
      continue;
    }

    events.push({
      id: followUp.id,
      customerId: followUp.customerId,
      status: 'PLANNED',
      scheduledAt: followUp.dueAt,
      note: followUp.note,
    });
  }

  return { events, diagnostics };
}
