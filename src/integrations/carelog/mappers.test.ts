import { describe, expect, it } from 'vitest';

import type { CustomerEvent } from '@/domain/customerEvent';
import { CarelogProtocolError } from '@/integrations/carelog/errors';
import {
  mapCustomerResponse,
  mapCustomerEventResponse,
  toCustomerCreateBody,
  toCustomerEventCreateBody,
  toCustomerEventPatchBody,
} from '@/integrations/carelog/mappers';

const customerId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const eventId = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';

describe('Carelog wire mappers', () => {
  it('maps CustomerResponse to the product Customer without authority fields', () => {
    const customer = mapCustomerResponse({
      publicId: customerId,
      displayName: '  박세입  ',
      customerMemo: null,
    });

    expect(customer).toEqual({ id: customerId, displayName: '박세입' });
    expect(customer).not.toHaveProperty('organizationId');
    expect(customer).not.toHaveProperty('workspaceId');
    expect(customer).not.toHaveProperty('workspace');
  });

  it('normalizes customer create memo explicitly for the backend contract', () => {
    expect(toCustomerCreateBody({ displayName: ' 고객 ', customerMemo: '  메모  ' })).toEqual({
      displayName: '고객',
      customerMemo: '메모',
    });
    expect(toCustomerCreateBody({ displayName: '고객', customerMemo: '   ' })).toEqual({
      displayName: '고객',
      customerMemo: null,
    });
  });

  it('maps every canonical CustomerEvent status and rejects invariant violations', () => {
    expect(
      mapCustomerEventResponse({
        id: eventId,
        customerId,
        status: 'PLANNED',
        scheduledAt: '2026-08-20T10:00:00+09:00',
        descriptor: null,
        note: ' 메모 ',
      }),
    ).toEqual({
      id: eventId,
      customerId,
      status: 'PLANNED',
      scheduledAt: '2026-08-20T10:00:00+09:00',
      note: '메모',
    });

    expect(
      mapCustomerEventResponse({
        id: eventId,
        customerId,
        status: 'OCCURRED',
        scheduledAt: null,
        occurredAt: '2026-08-20T10:30:00+09:00',
        descriptor: '기록',
        note: null,
      }),
    ).toMatchObject({ status: 'OCCURRED', occurredAt: '2026-08-20T10:30:00+09:00' });

    expect(
      mapCustomerEventResponse({
        id: eventId,
        customerId,
        status: 'CANCELLED',
        scheduledAt: '2026-08-20T11:00:00+09:00',
        occurredAt: null,
        descriptor: '취소',
        note: null,
      }),
    ).toMatchObject({ status: 'CANCELLED', scheduledAt: '2026-08-20T11:00:00+09:00' });

    expect(() =>
      mapCustomerEventResponse({
        id: eventId,
        customerId,
        status: 'PLANNED',
        scheduledAt: null,
        occurredAt: '2026-08-20T10:30:00+09:00',
      }),
    ).toThrow(CarelogProtocolError);
  });

  it('does not send overdue, workspace, organization, or internal identifiers', () => {
    const body = toCustomerEventCreateBody({
      status: 'PLANNED',
      customerId,
      scheduledAt: '2026-08-20T10:00:00+09:00',
      descriptor: ' 상담 ',
      note: ' 메모 ',
    });

    expect(body).toEqual({
      customerId,
      status: 'PLANNED',
      scheduledAt: '2026-08-20T10:00:00+09:00',
      descriptor: '상담',
      note: '메모',
    });
    expect(body).not.toHaveProperty('overdue');
    expect(body).not.toHaveProperty('organizationId');
    expect(body).not.toHaveProperty('workspaceId');
  });

  it('uses JSON property presence for unchanged, clear, and changed event fields', () => {
    const event: CustomerEvent = {
      id: eventId,
      customerId,
      status: 'PLANNED',
      scheduledAt: '2026-08-20T10:00:00+09:00',
      descriptor: '기존 제목',
      note: '기존 메모',
    };

    expect(
      toCustomerEventPatchBody(event, {
        descriptor: ' 기존 제목 ',
        note: '  ',
        scheduledAt: event.scheduledAt,
      }),
    ).toEqual({ note: null });
    expect(toCustomerEventPatchBody(event, { descriptor: '새 제목', note: '새 메모' })).toEqual({
      descriptor: '새 제목',
      note: '새 메모',
    });
  });
});
