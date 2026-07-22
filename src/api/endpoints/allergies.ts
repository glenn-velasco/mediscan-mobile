import { apiClient } from '@/api/client';
import type { AllergyPayload } from '@/api/types';

export type AllergyApiRecord = AllergyPayload & {
  id: string;
  deleted_at?: string | null;
  updated_at: string;
};

export function createAllergy(id: string, payload: AllergyPayload) {
  return apiClient.post<AllergyApiRecord>('api/v1/allergies', { id, ...payload });
}

export function updateAllergy(id: string, payload: AllergyPayload) {
  return apiClient.put<AllergyApiRecord>(`api/v1/allergies/${id}`, payload);
}

export function deleteAllergy(id: string) {
  return apiClient.delete<null>(`api/v1/allergies/${id}`);
}
