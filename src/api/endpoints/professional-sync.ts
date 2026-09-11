import { invokeFunction } from '@/api/supabase';
import type { EnvelopeSubmitPayload, PendingSyncEnvelope } from '@/api/types';

export type VerificationStatusResponse = {
  allergies: { item: string; verified: boolean; verified_at: string | null }[];
  conditions: { item: string; verified: boolean; verified_at: string | null }[];
  diagnoses: { item: string; verified: boolean; verified_at: string | null }[];
  medications: { item: string; verified: boolean; verified_at: string | null }[];
};

export function getPatientPublicKey(patientId: string | number) {
  return invokeFunction<{ public_key: string }>('professional-patient-public-key', { patient_id: patientId });
}

export function submitEnvelope(
  patientId: string | number,
  payload: EnvelopeSubmitPayload & {
    item_identifier?: string;
    verified?: boolean;
  }
) {
  return invokeFunction<PendingSyncEnvelope>('professional-submit-envelope', { patient_id: patientId, ...payload });
}

export function getPatientVerifications(patientId: string | number) {
  return invokeFunction<VerificationStatusResponse>('professional-patient-verifications', { patient_id: patientId });
}

export function trackVerification(
  patientId: string | number,
  payload: { envelope_type: string; item_identifier: string; verified: boolean }
) {
  return invokeFunction<null>('professional-track-verification', { patient_id: patientId, ...payload });
}
