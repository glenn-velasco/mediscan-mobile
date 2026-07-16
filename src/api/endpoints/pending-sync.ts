import { apiClient } from '@/api/client';
import type { PendingSyncEnvelope } from '@/api/types';

export function getPendingSync() {
  return apiClient.get<{ envelopes: PendingSyncEnvelope[] }>('api/v1/pending-sync');
}

export function ackEnvelope(envelopeId: number) {
  return apiClient.post<null>(`api/v1/pending-sync/${envelopeId}/ack`);
}
