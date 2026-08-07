import type {
  Customer,
  CustomerContext,
  FollowUp,
  Interaction,
  User,
  Workspace,
} from '@/types/customer';

export interface ScenarioFixture {
  id: 'landlord-tenant' | 'therapist-patient';
  user: User;
  workspace: Workspace;
  customer: Customer;
  context: CustomerContext;
  interaction: Interaction;
  followUp: FollowUp;
}

/**
 * Scenario A: 임대인 User -> 임차인 Customer. Same Customer core model as
 * the therapist scenario below; only display copy differs by scenario.
 */
export const landlordTenantScenario: ScenarioFixture = {
  id: 'landlord-tenant',
  user: { id: 'user-landlord-1', workspaceId: 'workspace-1', name: '김임대' },
  workspace: { id: 'workspace-1', name: '해담빌라 임대 관리' },
  customer: { id: 'customer-tenant-1', workspaceId: 'workspace-1', displayName: '박세입' },
  context: {
    customerId: 'customer-tenant-1',
    summary: '301호, 계약 갱신 논의 중',
    updatedAt: '2026-08-01T09:00:00+09:00',
  },
  interaction: {
    id: 'interaction-tenant-1',
    customerId: 'customer-tenant-1',
    occurredAt: '2026-07-20T14:00:00+09:00',
    note: '전화로 계약 갱신 의사 확인, 오후 시간대 연락 선호',
  },
  followUp: {
    id: 'followup-tenant-1',
    customerId: 'customer-tenant-1',
    dueAt: '2026-08-15T10:00:00+09:00',
    note: '계약 갱신 여부 재확인',
    done: false,
  },
};

/**
 * Scenario B: 물리치료사 User -> 환자·내원 고객 Customer. Deliberately
 * limited to contact/visit metadata; no diagnosis, treatment plan, or other
 * sensitive health information (P0 bootstrap scope only).
 */
export const therapistPatientScenario: ScenarioFixture = {
  id: 'therapist-patient',
  user: { id: 'user-therapist-1', workspaceId: 'workspace-2', name: '이물리' },
  workspace: { id: 'workspace-2', name: '단단정형 물리치료실' },
  customer: { id: 'customer-patient-1', workspaceId: 'workspace-2', displayName: '최내원' },
  context: {
    customerId: 'customer-patient-1',
    summary: '최근 내원일 2026-07-28, 오전 시간대 연락 선호',
    updatedAt: '2026-07-28T11:00:00+09:00',
  },
  interaction: {
    id: 'interaction-patient-1',
    customerId: 'customer-patient-1',
    occurredAt: '2026-07-28T10:30:00+09:00',
    note: '내원 확인, 다음 방문 일정 문의 예정',
  },
  followUp: {
    id: 'followup-patient-1',
    customerId: 'customer-patient-1',
    dueAt: '2026-08-11T09:30:00+09:00',
    note: '다음 방문 일정 확인 연락',
    done: false,
  },
};

export const SCENARIO_FIXTURES: readonly ScenarioFixture[] = [
  landlordTenantScenario,
  therapistPatientScenario,
];
