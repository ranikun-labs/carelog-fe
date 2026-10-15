import { createCarelogAuthRuntime, type CarelogAuthRuntime } from '@/integrations/carelog/authPort';

let productionRuntime: CarelogAuthRuntime | undefined;

/** One page-scoped token session is shared by AuthProvider and product requests. */
export function getProductionCarelogAuthRuntime(): CarelogAuthRuntime {
  productionRuntime ??= createCarelogAuthRuntime({
    apiBaseUrl: readCarelogApiBaseUrl() ?? '',
  });
  return productionRuntime;
}

function readCarelogApiBaseUrl(): string | undefined {
  const value = import.meta.env.VITE_CARELOG_API_BASE_URL;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
