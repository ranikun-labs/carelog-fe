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
  workspaceId: string;
  displayName: string;
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
