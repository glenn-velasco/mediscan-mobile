import { invokeFunction } from '@/api/supabase';
import type { PaginatedResponse, ScanActivity } from '@/api/types';

type GetMyScanActivityParams = {
  page?: number;
  per_page?: number;
};

type ScanActivityResponse = {
  data: ScanActivity[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
};

export async function getMyScanActivity(
  params?: GetMyScanActivityParams,
): Promise<PaginatedResponse<ScanActivity>> {
  const response = await invokeFunction<ScanActivityResponse>('my-scan-activity', params);
  if (!response) {
    return { data: [], meta: { current_page: 1, last_page: 1, per_page: 20, total: 0 }, links: { first: null, last: null, prev: null, next: null } };
  }
  return {
    data: response.data ?? [],
    meta: response.meta ?? { current_page: 1, last_page: 1, per_page: 20, total: 0 },
    links: response.links ?? { first: null, last: null, prev: null, next: null },
  };
}
