import { adaptLegacyCustomerEvents } from '@/adapters/legacyCustomerEventAdapter';
import { landlordTenantScenario } from '@/fixtures/scenarios';
import type { FollowUp } from '@/types/customer';

describe('adaptLegacyCustomerEvents', () => {
  it('maps TimelineEntry to an OCCURRED event with label as an optional descriptor', () => {
    const entry = landlordTenantScenario.timeline[0];
    const result = adaptLegacyCustomerEvents({ timelineEntries: [entry], followUps: [] });

    expect(result).toEqual({
      events: [
        {
          id: entry.id,
          customerId: entry.customerId,
          status: 'OCCURRED',
          occurredAt: entry.occurredAt,
          descriptor: entry.label,
        },
      ],
      diagnostics: [],
    });
  });

  it('maps only an unfinished FollowUp to PLANNED using dueAt as scheduledAt', () => {
    const followUp = landlordTenantScenario.followUp;
    const result = adaptLegacyCustomerEvents({ timelineEntries: [], followUps: [followUp] });

    expect(result).toEqual({
      events: [
        {
          id: followUp.id,
          customerId: followUp.customerId,
          status: 'PLANNED',
          scheduledAt: followUp.dueAt,
          note: followUp.note,
        },
      ],
      diagnostics: [],
    });
  });

  it('does not invent OCCURRED for a completed FollowUp without occurrence evidence', () => {
    const completedFollowUp: FollowUp = {
      ...landlordTenantScenario.followUp,
      done: true,
    };
    const result = adaptLegacyCustomerEvents({
      timelineEntries: [],
      followUps: [completedFollowUp],
    });

    expect(result.events).toEqual([]);
    expect(result.diagnostics).toEqual([
      {
        code: 'COMPLETED_FOLLOW_UP_WITHOUT_OCCURRENCE_EVIDENCE',
        source: 'FollowUp',
        sourceId: completedFollowUp.id,
        customerId: completedFollowUp.customerId,
      },
    ]);
  });

  it('does not create a duplicate event from an Interaction at a TimelineEntry instant', () => {
    const overlappingEntry = landlordTenantScenario.timeline.find(
      (entry) => entry.occurredAt === landlordTenantScenario.interaction.occurredAt,
    );

    expect(overlappingEntry).toBeDefined();

    const result = adaptLegacyCustomerEvents({
      timelineEntries: overlappingEntry ? [overlappingEntry] : [],
      followUps: [],
    });

    expect(result.events).toHaveLength(1);
    expect(result.events).not.toContainEqual(
      expect.objectContaining({ id: landlordTenantScenario.interaction.id }),
    );
  });
});
