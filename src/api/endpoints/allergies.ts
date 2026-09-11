import { createEncrypted, softDeleteEncrypted, updateEncrypted } from '@/api/encrypted-crud';
import type { AllergyPayload } from '@/api/types';

export type AllergyApiRecord = AllergyPayload & {
  id: string;
  deleted_at?: string | null;
  updated_at: string;
};

export function createAllergy(id: string, payload: AllergyPayload) {
  return createEncrypted('allergies', id, payload);
}

export function updateAllergy(id: string, payload: AllergyPayload) {
  return updateEncrypted('allergies', id, payload);
}

export function deleteAllergy(id: string) {
  return softDeleteEncrypted('allergies', id);
}
