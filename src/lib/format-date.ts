/** Formats a `YYYY-MM-DD` date-only string (e.g. `medical_information.date_of_birth`) as e.g. "July 22, 1990". Also tolerates a full ISO datetime string (e.g. `2026-07-20T00:00:00.000000Z`) by taking its date portion. Returns the original value unparsed if it isn't a valid date, rather than crashing on unexpected input. */
export function formatIsoDate(value: string | null | undefined): string {
  if (!value) return '';

  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const parsed = new Date(year, (month ?? 1) - 1, day ?? 1);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

/** Formats a full ISO 8601 datetime string (e.g. `new Date().toISOString()`, as used in the QR "Generated" field) as e.g. "July 22, 2026, 5:28 AM". */
export function formatIsoDateTime(value: string | null | undefined): string {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
