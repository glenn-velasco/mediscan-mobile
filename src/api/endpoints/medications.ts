import { apiClient } from '@/api/client';
import type { MedicationPayload } from '@/api/types';

export type MedicationApiRecord = MedicationPayload & {
  id: string;
  deleted_at?: string | null;
  updated_at: string;
};

export function createMedication(id: string, payload: MedicationPayload) {
  return apiClient.post<MedicationApiRecord>('api/v1/medications', { id, ...payload });
}

export function updateMedication(id: string, payload: MedicationPayload) {
  return apiClient.put<MedicationApiRecord>(`api/v1/medications/${id}`, payload);
}

export function deleteMedication(id: string) {
  return apiClient.delete<null>(`api/v1/medications/${id}`);
}
