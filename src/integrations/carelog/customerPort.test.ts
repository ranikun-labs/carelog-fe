import { describe, expect, it, vi } from 'vitest';

import { createCarelogCustomerPort } from '@/integrations/carelog/customerPort';

describe('Carelog Customer port', () => {
  it('uses server publicId as the FE identity and keeps organization/workspace out of the DTO', async () => {
    const client = {
      get: vi.fn().mockResolvedValue([
        {
          publicId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
          displayName: ' 고객 ',
          customerMemo: null,
        },
      ]),
      post: vi.fn(),
      patch: vi.fn(),
    };
    const port = createCarelogCustomerPort(client);

    await expect(port.list()).resolves.toEqual([
      { id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8', displayName: '고객' },
    ]);
    expect(client.get).toHaveBeenCalledWith('/api/v1/users/customers');
  });

  it('reconciles create and edit from server responses, including explicit memo clear', async () => {
    const client = {
      get: vi.fn(),
      post: vi.fn().mockResolvedValue({
        publicId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        displayName: '새 고객',
        customerMemo: null,
      }),
      patch: vi.fn().mockResolvedValue({
        publicId: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
        displayName: '새 고객',
        customerMemo: '',
      }),
    };
    const port = createCarelogCustomerPort(client);
    const created = await port.create({ displayName: '새 고객' });
    const current = { ...created, customerMemo: '기존 메모' };
    const edited = await port.edit(created.id, current, {
      displayName: '새 고객',
      customerMemo: '   ',
    });

    expect(created.id).toBe('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
    expect(edited).toEqual({ id: created.id, displayName: '새 고객' });
    expect(client.post).toHaveBeenCalledWith('/api/v1/users/customers', {
      displayName: '새 고객',
      customerMemo: null,
    });
    expect(client.patch).toHaveBeenCalledWith(
      '/api/v1/users/customers/6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      {
        customerMemo: '',
      },
    );
  });
});
