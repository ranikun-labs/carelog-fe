import { buildAppCustomerDetailPath, buildAppCustomerImportPath } from '@/constants/routes';
import {
  SCENARIO_FIXTURES,
  landlordTenantScenario,
  therapistPatientScenario,
} from '@/fixtures/scenarios';

const SENSITIVE_HEALTH_TERMS = /진단|치료계획|처방|소견|병력|증상/u;

describe('bootstrap scenario fixtures', () => {
  it('share the same Customer core model shape across scenarios', () => {
    expect(Object.keys(landlordTenantScenario.customer).sort()).toEqual(
      Object.keys(therapistPatientScenario.customer).sort(),
    );
    expect(Object.keys(landlordTenantScenario.context).sort()).toEqual(
      Object.keys(therapistPatientScenario.context).sort(),
    );
    expect(Object.keys(landlordTenantScenario.followUp).sort()).toEqual(
      Object.keys(therapistPatientScenario.followUp).sort(),
    );
    expect(Object.keys(landlordTenantScenario.timeline[0]).sort()).toEqual(
      Object.keys(therapistPatientScenario.timeline[0]).sort(),
    );
  });

  it('resolve every scenario customer through the same generic route builders', () => {
    for (const scenario of SCENARIO_FIXTURES) {
      expect(buildAppCustomerDetailPath(scenario.customer.id)).toBe(
        `/app/customers/${scenario.customer.id}`,
      );
      expect(buildAppCustomerImportPath(scenario.customer.id)).toBe(
        `/app/customers/${scenario.customer.id}/import`,
      );
      expect(scenario.context.customerId).toBe(scenario.customer.id);
      expect(scenario.followUp.customerId).toBe(scenario.customer.id);
    }
  });

  it('gives every scenario at least two ordered timeline entries for the same customer', () => {
    for (const scenario of SCENARIO_FIXTURES) {
      expect(scenario.timeline.length).toBeGreaterThanOrEqual(2);
      for (const entry of scenario.timeline) {
        expect(entry.customerId).toBe(scenario.customer.id);
      }
      const occurredAtValues = scenario.timeline.map((entry) => entry.occurredAt);
      expect(new Set(occurredAtValues).size).toBe(occurredAtValues.length);
    }
  });

  it('keeps the physical-therapy scenario free of sensitive health information', () => {
    const serialized = JSON.stringify(therapistPatientScenario);
    expect(serialized).not.toMatch(SENSITIVE_HEALTH_TERMS);
  });

  it('does not use Tenant or Patient as core type, route, or component names', () => {
    for (const scenario of SCENARIO_FIXTURES) {
      expect(Object.keys(scenario)).not.toContain('tenant');
      expect(Object.keys(scenario)).not.toContain('patient');
    }
  });
});
