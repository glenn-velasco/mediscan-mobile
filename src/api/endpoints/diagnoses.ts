import { apiClient } from '@/api/client';
import type { DiagnosisPayload } from '@/api/types';

export type DiagnosisApiRecord = DiagnosisPayload & {
  id: string;
  deleted_at?: string | null;
  updated_at: string;
};

export function createDiagnosis(id: string, payload: DiagnosisPayload) {
  return apiClient.post<DiagnosisApiRecord>('api/v1/diagnoses', { id, ...payload });
}

export function updateDiagnosis(id: string, payload: DiagnosisPayload) {
  return apiClient.put<DiagnosisApiRecord>(`api/v1/diagnoses/${id}`, payload);
}

export function deleteDiagnosis(id: string) {
  return apiClient.delete<null>(`api/v1/diagnoses/${id}`);
}
