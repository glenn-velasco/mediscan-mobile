import { apiClient } from '@/api/client';
import type { EmergencyContactPayload } from '@/api/types';

export type EmergencyContactApiRecord = EmergencyContactPayload & {
  id: string;
  deleted_at?: string | null;
  updated_at: string;
};

export function createEmergencyContact(id: string, payload: EmergencyContactPayload) {
  return apiClient.post<EmergencyContactApiRecord>('api/v1/emergency-contacts', { id, ...payload });
}

export function updateEmergencyContact(id: string, payload: EmergencyContactPayload) {
  return apiClient.put<EmergencyContactApiRecord>(`api/v1/emergency-contacts/${id}`, payload);
}

export function deleteEmergencyContact(id: string) {
  return apiClient.delete<null>(`api/v1/emergency-contacts/${id}`);
}
