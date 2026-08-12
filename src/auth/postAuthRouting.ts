import { buildAppCustomersPath, buildAppSchedulePath } from '@/constants/routes';

export type SafeResumeIntent = {
  kind: 'internal-product-route';
  destination: 'schedule' | 'customers';
};

/**
 * Only known product destinations become resume intent. The raw pathname is
 * deliberately discarded so this value cannot become an open-redirect policy.
 */
export function toSafeResumeIntent(pathname: string): SafeResumeIntent | undefined {
  if (pathname === '/app' || pathname.startsWith('/app/schedule')) {
    return { kind: 'internal-product-route', destination: 'schedule' };
  }
  if (pathname.startsWith('/app/customers')) {
    return { kind: 'internal-product-route', destination: 'customers' };
  }
  return undefined;
}

export function resolvePostAuthPath(customerCount: number, intent?: SafeResumeIntent): string {
  void intent;
  // The explicit product contract wins over a remembered route: existing
  // customers start at Schedule, while first-use customers start at Customers.
  return customerCount > 0 ? buildAppSchedulePath() : buildAppCustomersPath();
}
