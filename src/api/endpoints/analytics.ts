import { apiClient } from '@/api/client';

export function logEmergencyQrEvent(payload: { action: 'shown' | 'scanned'; patient_id: number; context?: string }) {
  return apiClient.post<null>('api/v1/emergency-qr/events', payload);
}
