import { apiClient } from '@/api/client';
import type { EnvelopeSubmitPayload, PendingSyncEnvelope } from '@/api/types';

export type VerificationStatusResponse = {
  allergies: { item: string; verified: boolean; verified_at: string | null }[];
  conditions: { item: string; verified: boolean; verified_at: string | null }[];
  diagnoses: { item: string; verified: boolean; verified_at: string | null }[];
  medications: { item: string; verified: boolean; verified_at: string | null }[];
};

export function getPatientPublicKey(patientId: number) {
  return apiClient.get<{ public_key: string }>(`api/v1/professional/patients/${patientId}/public-key`);
}

export function submitEnvelope(
  patientId: number,
  payload: EnvelopeSubmitPayload & {
    item_identifier?: string;
    verified?: boolean;
  }
) {
  return apiClient.post<PendingSyncEnvelope>(
    `api/v1/professional/patients/${patientId}/envelopes`,
    payload
  );
}

export function getPatientVerifications(patientId: number) {
  return apiClient.get<VerificationStatusResponse>(
    `api/v1/professional/patients/${patientId}/verifications`
  );
}

export function trackVerification(
  patientId: number,
  payload: { envelope_type: string; item_identifier: string; verified: boolean }
) {
  return apiClient.post<null>(
    `api/v1/professional/patients/${patientId}/verifications`,
    payload
  );
}
