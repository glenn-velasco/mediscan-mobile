import { z } from 'zod';
import { isValidCalendarDate } from '@/lib/validation/calendar-date';

export const dateOfBirthSchema = z
  .string()
  .trim()
  .min(1, 'Date of birth is required')
  .refine((val) => {
    if (!isValidCalendarDate(val)) return false;
    const eighteenYearsAgo = new Date();
    eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
    eighteenYearsAgo.setHours(0, 0, 0, 0);
    return val <= `${eighteenYearsAgo.getFullYear()}-${String(eighteenYearsAgo.getMonth() + 1).padStart(2, '0')}-${String(eighteenYearsAgo.getDate()).padStart(2, '0')}`;
  }, 'Enter a valid date of birth; you must be at least 18 years old');
