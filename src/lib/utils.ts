import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Fixed `YYYY-MM-DD` slice of an ISO timestamp; no timezone conversion. */
export function formatDate(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}
