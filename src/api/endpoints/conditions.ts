import { apiClient } from '@/api/client';
import type { ConditionPayload } from '@/api/types';

export type ConditionApiRecord = ConditionPayload & {
  id: string;
  deleted_at?: string | null;
  updated_at: string;
};

export function createCondition(id: string, payload: ConditionPayload) {
  return apiClient.post<ConditionApiRecord>('api/v1/conditions', { id, ...payload });
}

export function updateCondition(id: string, payload: ConditionPayload) {
  return apiClient.put<ConditionApiRecord>(`api/v1/conditions/${id}`, payload);
}

export function deleteCondition(id: string) {
  return apiClient.delete<null>(`api/v1/conditions/${id}`);
}
