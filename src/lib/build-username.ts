import type { Suffix } from '@/constants/suffix';

export function buildUsername(parts: {
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: Suffix;
}): string {
  const middleInitial = parts.middle_name?.trim() ? parts.middle_name.trim()[0] : undefined;
  return [parts.first_name, middleInitial, parts.last_name, parts.suffix]
    .filter(Boolean)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}
