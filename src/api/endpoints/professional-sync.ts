import { apiClient } from '@/api/client';
import type { EnvelopeSubmitPayload, PendingSyncEnvelope } from '@/api/types';

export function getPatientPublicKey(patientId: number) {
  return apiClient.get<{ public_key: string }>(`api/v1/professional/patients/${patientId}/public-key`);
}

export function submitEnvelope(patientId: number, payload: EnvelopeSubmitPayload) {
  return apiClient.post<PendingSyncEnvelope>(`api/v1/professional/patients/${patientId}/envelopes`, payload);
}
