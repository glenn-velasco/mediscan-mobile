import { createEncrypted, softDeleteEncrypted, updateEncrypted } from '@/api/encrypted-crud';
import type { EmergencyContactPayload } from '@/api/types';

export type EmergencyContactApiRecord = EmergencyContactPayload & {
  id: string;
  deleted_at?: string | null;
  updated_at: string;
};

export function createEmergencyContact(id: string, payload: EmergencyContactPayload) {
  return createEncrypted('emergency_contacts', id, payload);
}

export function updateEmergencyContact(id: string, payload: EmergencyContactPayload) {
  return updateEncrypted('emergency_contacts', id, payload);
}

export function deleteEmergencyContact(id: string) {
  return softDeleteEncrypted('emergency_contacts', id);
}
