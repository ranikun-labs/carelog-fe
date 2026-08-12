import { buildAppCustomersPath, buildAppSchedulePath } from '@/constants/routes';

export function resolvePostAuthPath(customerCount: number): string {
  // The explicit product contract wins over a remembered route: existing
  // customers start at Schedule, while first-use customers start at Customers.
  return customerCount > 0 ? buildAppSchedulePath() : buildAppCustomersPath();
}
