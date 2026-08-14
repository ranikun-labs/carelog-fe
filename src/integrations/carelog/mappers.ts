import type { CustomerEvent, CustomerEventEdit } from '@/domain/customerEvent';
import { CarelogProtocolError } from '@/integrations/carelog/errors';
import type { CustomerCreateInput } from '@/state/customerStore';
import type { CustomerRecord } from '@/types/customer';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OFFSET_TIMESTAMP_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/;

export interface CustomerResponseWire {
  publicId: unknown;
  displayName: unknown;
  customerMemo?: unknown;
}

export interface CustomerEventResponseWire {
  id: unknown;
  customerId: unknown;
  status: unknown;
  scheduledAt?: unknown;
  occurredAt?: unknown;
  descriptor?: unknown;
  note?: unknown;
}

export type CustomerEventCreateInput =
  | {
      status: 'PLANNED';
      customerId: string;
      scheduledAt: string;
      descriptor?: string;
      note?: string;
    }
  | {
      status: 'OCCURRED';
      customerId: string;
      occurredAt: string;
      descriptor?: string;
      note?: string;
    };

export type CustomerEventPatchBody = {
  descriptor?: string | null;
  note?: string | null;
  scheduledAt?: string;
  occurredAt?: string;
};

export function mapCustomerResponse(value: unknown): CustomerRecord {
  const candidate = asRecord(value, 'CustomerResponse');
  const id = requireUuid(candidate.publicId, 'CustomerResponse.publicId');
  const displayName = requireNonBlankString(candidate.displayName, 'CustomerResponse.displayName');
  const customerMemo = mapCustomerMemo(candidate.customerMemo);
  return { id, displayName, ...(customerMemo === undefined ? {} : { customerMemo }) };
}

export function toCustomerCreateBody(input: CustomerCreateInput): {
  displayName: string;
  customerMemo: string | null;
} {
  const displayName = normalizeRequiredText(input.displayName, 'displayName');
  const customerMemo = normalizeOptionalInput(input.customerMemo);
  return { displayName, customerMemo: customerMemo ?? null };
}

export function toCustomerEditBody(
  current: CustomerRecord,
  input: CustomerCreateInput,
): { displayName?: string; customerMemo?: string } {
  const nextDisplayName = normalizeRequiredText(input.displayName, 'displayName');
  const body: { displayName?: string; customerMemo?: string } = {};
  if (nextDisplayName !== current.displayName) body.displayName = nextDisplayName;

  const currentMemo = current.customerMemo ?? '';
  const nextMemo = normalizeOptionalInput(input.customerMemo) ?? '';
  if (nextMemo !== currentMemo) body.customerMemo = nextMemo;
  return body;
}

export function mapCustomerEventResponse(value: unknown): CustomerEvent {
  const candidate = asRecord(value, 'CustomerEventResponse');
  const id = requireUuid(candidate.id, 'CustomerEventResponse.id');
  const customerId = requireUuid(candidate.customerId, 'CustomerEventResponse.customerId');
  const status = candidate.status;
  const scheduledAt = mapOptionalTimestamp(candidate.scheduledAt, 'scheduledAt');
  const occurredAt = mapOptionalTimestamp(candidate.occurredAt, 'occurredAt');
  const descriptor = mapOptionalText(candidate.descriptor, 'descriptor');
  const note = mapOptionalText(candidate.note, 'note');

  if (status === 'PLANNED') {
    if (!scheduledAt || occurredAt !== undefined) throw invalidEventInvariant();
    return {
      id,
      customerId,
      status,
      scheduledAt,
      ...(descriptor === undefined ? {} : { descriptor }),
      ...(note === undefined ? {} : { note }),
    };
  }
  if (status === 'OCCURRED') {
    if (!occurredAt) throw invalidEventInvariant();
    return {
      id,
      customerId,
      status,
      occurredAt,
      ...(scheduledAt === undefined ? {} : { scheduledAt }),
      ...(descriptor === undefined ? {} : { descriptor }),
      ...(note === undefined ? {} : { note }),
    };
  }
  if (status === 'CANCELLED') {
    if (!scheduledAt || occurredAt !== undefined) throw invalidEventInvariant();
    return {
      id,
      customerId,
      status,
      scheduledAt,
      ...(descriptor === undefined ? {} : { descriptor }),
      ...(note === undefined ? {} : { note }),
    };
  }
  throw invalidEventInvariant();
}

export function toCustomerEventCreateBody(input: CustomerEventCreateInput): Record<string, string> {
  const body: Record<string, string> = {
    customerId: requireUuid(input.customerId, 'customerId'),
    status: input.status,
  };
  if (input.status === 'PLANNED') {
    body.scheduledAt = normalizeRequiredTimestamp(input.scheduledAt, 'scheduledAt');
  } else {
    body.occurredAt = normalizeRequiredTimestamp(input.occurredAt, 'occurredAt');
  }
  const descriptor = normalizeOptionalInput(input.descriptor);
  const note = normalizeOptionalInput(input.note);
  if (descriptor !== undefined) body.descriptor = descriptor;
  if (note !== undefined) body.note = note;
  return body;
}

export function toCustomerEventPatchBody(
  current: CustomerEvent,
  changes: CustomerEventEdit,
): CustomerEventPatchBody {
  const body: CustomerEventPatchBody = {};
  const currentDescriptor = current.descriptor ?? '';
  const currentNote = current.note ?? '';
  const nextDescriptor = normalizeOptionalInput(changes.descriptor);
  const nextNote = normalizeOptionalInput(changes.note);

  if (nextDescriptor !== undefined && nextDescriptor !== currentDescriptor) {
    body.descriptor = nextDescriptor || null;
  } else if (changes.descriptor !== undefined && nextDescriptor === undefined) {
    body.descriptor = null;
  }
  if (nextNote !== undefined && nextNote !== currentNote) {
    body.note = nextNote || null;
  } else if (changes.note !== undefined && nextNote === undefined) {
    body.note = null;
  }
  if (changes.scheduledAt !== undefined && changes.scheduledAt !== current.scheduledAt) {
    body.scheduledAt = normalizeRequiredTimestamp(changes.scheduledAt, 'scheduledAt');
  }
  if (changes.occurredAt !== undefined && changes.occurredAt !== current.occurredAt) {
    body.occurredAt = normalizeRequiredTimestamp(changes.occurredAt, 'occurredAt');
  }
  return body;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new CarelogProtocolError(`${label} is not an object.`, value);
  }
  return value as Record<string, unknown>;
}

function requireUuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new CarelogProtocolError(`${label} is not a UUID.`, value);
  }
  return value;
}

function requireNonBlankString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CarelogProtocolError(`${label} is not a non-blank string.`, value);
  }
  return value.trim();
}

function mapOptionalText(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new CarelogProtocolError(`${label} is not a string.`, value);
  const normalized = value.trim();
  if (!normalized) throw new CarelogProtocolError(`${label} is blank.`, value);
  return normalized;
}

function mapCustomerMemo(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new CarelogProtocolError('CustomerResponse.customerMemo is not a string.', value);
  }
  const normalized = value.trim();
  return normalized || undefined;
}

function mapOptionalTimestamp(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (
    typeof value !== 'string' ||
    !OFFSET_TIMESTAMP_PATTERN.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new CarelogProtocolError(`${label} is not an offset-bearing timestamp.`, value);
  }
  return value;
}

function normalizeRequiredText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new CarelogProtocolError(`${label} must not be blank.`, value);
  return normalized;
}

function normalizeRequiredTimestamp(value: string, label: string): string {
  if (!value || !OFFSET_TIMESTAMP_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    throw new CarelogProtocolError(`${label} must be an offset-bearing timestamp.`, value);
  }
  return value;
}

function normalizeOptionalInput(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined;
  const normalized = value.trim();
  return normalized || undefined;
}

function invalidEventInvariant(): CarelogProtocolError {
  return new CarelogProtocolError('CustomerEventResponse violates the canonical invariant.');
}
