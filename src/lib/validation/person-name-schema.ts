import { z } from 'zod';

// Unicode letters allow Filipino and other international names; spaces, apostrophes,
// periods and hyphens cover common name punctuation without accepting digits.
const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[\p{L}\p{M} .'\u2019-]*[\p{L}\p{M}.])?$/u;

export const personName = (label: string) => z.string().trim()
  .min(1, `${label} is required`)
  .max(255, `${label} must be 255 characters or fewer`)
  .regex(NAME_PATTERN, `${label} must contain letters only, with optional spaces, apostrophes, periods, or hyphens`);

export const optionalPersonName = (label: string) => z.string().trim()
  .max(255, `${label} must be 255 characters or fewer`)
  .refine((value) => !value || NAME_PATTERN.test(value), `${label} must contain letters only, with optional spaces, apostrophes, periods, or hyphens`);
