import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Joins conditional className fragments and resolves Tailwind utility conflicts (last one wins per property). */
export function cn(...values: ClassValue[]): string {
  return twMerge(clsx(values));
}
