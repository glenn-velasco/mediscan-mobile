/** Accept only a real ISO calendar day, including leap-year handling. */
export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isPastCalendarDate(value: string): boolean {
  return isValidCalendarDate(value) && value < new Date().toISOString().slice(0, 10);
}

export function isCurrentOrPastCalendarDate(value: string): boolean {
  return isValidCalendarDate(value) && value <= new Date().toISOString().slice(0, 10);
}
