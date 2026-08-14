import { describe, expect, it, vi } from 'vitest';

import { createProductionProductPorts } from '@/integrations/carelog/productionComposition';
import { createFixtureProductPorts } from '@/integrations/carelog/fixtureComposition';
import { CarelogConfigurationError, CarelogNetworkError } from '@/integrations/carelog/errors';

describe('Carelog product composition', () => {
  it('fails closed without an API base instead of selecting fixture data', async () => {
    const ports = createProductionProductPorts({ apiBaseUrl: '' });

    await expect(ports.customerPort.list()).rejects.toBeInstanceOf(CarelogConfigurationError);
    await expect(
      ports.customerEventPort.list({ customerId: 'customer-1', limit: 50 }),
    ).rejects.toBeInstanceOf(CarelogConfigurationError);
  });

  it('keeps HTTP failures in the production adapter boundary', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('offline'));
    const ports = createProductionProductPorts({
      apiBaseUrl: 'https://carelog.example.test',
      fetchImpl,
    });

    await expect(ports.customerPort.list()).rejects.toBeInstanceOf(CarelogNetworkError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('makes fixture use an explicit test composition', async () => {
    const ports = createFixtureProductPorts({ initialCustomers: [], initialEvents: [] });

    await expect(ports.customerPort.list()).resolves.toEqual([]);
    await expect(
      ports.customerEventPort.list({ customerId: 'customer-1', limit: 50 }),
    ).resolves.toEqual([]);
  });
});
