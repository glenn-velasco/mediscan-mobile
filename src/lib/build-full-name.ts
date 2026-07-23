import { SuffixLabel, type Suffix } from '@/constants/suffix';

export function buildFullName(parts: {
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: Suffix;
}): string {
  // Display label ("Jr"), not the raw enum value ("junior") - full_name is a
  // human-facing display string, shown as-is on the dashboard/QR summary/etc.
  const suffixLabel = parts.suffix ? SuffixLabel[parts.suffix] : undefined;
  return [parts.first_name, parts.middle_name, parts.last_name, suffixLabel].filter(Boolean).join(' ');
}
