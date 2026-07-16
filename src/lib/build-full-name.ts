import type { Suffix } from '@/constants/suffix';

export function buildFullName(parts: {
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: Suffix;
}): string {
  return [parts.first_name, parts.middle_name, parts.last_name, parts.suffix].filter(Boolean).join(' ');
}
