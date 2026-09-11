import { createEncrypted, softDeleteEncrypted, updateEncrypted } from '@/api/encrypted-crud';
import type { MedicationPayload } from '@/api/types';

export type MedicationApiRecord = MedicationPayload & {
  id: string;
  deleted_at?: string | null;
  updated_at: string;
};

export function createMedication(id: string, payload: MedicationPayload) {
  return createEncrypted('medications', id, payload);
}

export function updateMedication(id: string, payload: MedicationPayload) {
  return updateEncrypted('medications', id, payload);
}

export function deleteMedication(id: string) {
  return softDeleteEncrypted('medications', id);
}
