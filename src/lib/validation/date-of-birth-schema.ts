import { z } from 'zod';

export const dateOfBirthSchema = z
  .string()
  .trim()
  .min(1, 'Date of birth is required')
  .refine((val) => {
    const [year, month, day] = val.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    const eighteenYearsAgo = new Date();
    eighteenYearsAgo.setFullYear(eighteenYearsAgo.getFullYear() - 18);
    eighteenYearsAgo.setHours(0, 0, 0, 0);
    return !isNaN(d.getTime()) && d.getTime() < eighteenYearsAgo.getTime();
  }, 'You must be at least 18 years old');
