import { createEncrypted, softDeleteEncrypted, updateEncrypted } from '@/api/encrypted-crud';
import type { DiagnosedBy, DiagnosisPayload } from '@/api/types';

export type DiagnosisApiRecord = DiagnosisPayload & {
  id: string;
  diagnosed_by: DiagnosedBy | null;
  deleted_at?: string | null;
  updated_at: string;
};

export function createDiagnosis(_medicalInformationId: number, id: string, payload: DiagnosisPayload & { diagnosed_by?: DiagnosedBy | null }) {
  return createEncrypted('diagnoses', id, payload);
}

export function updateDiagnosis(id: string, payload: DiagnosisPayload) {
  return updateEncrypted('diagnoses', id, payload);
}

export function deleteDiagnosis(id: string) {
  return softDeleteEncrypted('diagnoses', id);
}
