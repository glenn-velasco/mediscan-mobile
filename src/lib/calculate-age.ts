/** Parses an ISO `YYYY-MM-DD` date of birth (see date-field.tsx's toIsoDate) and returns whole years elapsed, or null if it's missing/unparseable. */
export function calculateAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;
  const [year, month, day] = dateOfBirth.split('-').map(Number);
  if (!year || !month || !day) return null;

  const dob = new Date(year, month - 1, day);
  if (Number.isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const hadBirthdayThisYear = today.getMonth() > dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
  if (!hadBirthdayThisYear) age -= 1;

  return age >= 0 ? age : null;
}
