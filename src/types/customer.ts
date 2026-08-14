export interface User {
  id: string;
  workspaceId: string;
  name: string;
}

export interface Workspace {
  id: string;
  name: string;
}

export interface Customer {
  id: string;
  displayName: string;
  /** Explicit user-written customer note; legacy context is not promoted here. */
  customerMemo?: string;
}

export interface ScheduleCustomer {
  id: string;
  displayName: string;
}

/**
 * Customer application state keeps legacy fixture-backed views beside the mutable Customer
 * identity. New customers can omit those legacy snapshots until a later integration supplies them.
 */
export interface CustomerRecord extends Customer {
  /** Legacy fixture snapshot; production Customer records do not carry a workspace. */
  workspace?: Workspace;
  context?: CustomerContext;
  interaction?: Interaction;
}

export interface CustomerContext {
  customerId: string;
  summary: string;
  updatedAt: string;
}

export interface Interaction {
  id: string;
  customerId: string;
  occurredAt: string;
  note: string;
}

export interface TimelineEntry {
  id: string;
  customerId: string;
  occurredAt: string;
  label: string;
}

export interface FollowUp {
  id: string;
  customerId: string;
  dueAt: string;
  note: string;
  done: boolean;
}

export interface Handoff {
  id: string;
  customerId: string;
  createdAt: string;
  note: string;
}

export interface ImportCandidate {
  id: string;
  rawName: string;
  matchedCustomerId?: string;
}

export interface ReviewCandidate {
  id: string;
  customerId: string;
  createdAt: string;
}

export interface Evidence {
  id: string;
  customerId: string;
  sourceLabel: string;
}
