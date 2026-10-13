import { isValidCalendarDate } from '@/lib/validation/calendar-date';

/** Calculate completed years from a date-only value without timezone conversion. */
export function ageFromDateOfBirth(dateOfBirth: string | null | undefined, today = new Date()): number | null {
  if (!dateOfBirth || !isValidCalendarDate(dateOfBirth)) return null;
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age--;
  return age >= 0 ? age : null;
}
