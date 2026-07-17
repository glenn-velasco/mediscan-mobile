import { getDb } from '@/db/client';
import { getCurrentUserId } from '@/db/context';
import { encryptJson, decryptJson } from '@/lib/crypto';
import type { ProfessionalAttestationRow } from '@/db/schema';

export type ProfessionalAttestation<T = unknown> = {
  local_id: string;
  source_envelope_local_id: string;
  envelope_type: string;
  payload: T;
  matched_allergy_local_uuid: string | null;
  matched_diagnosis_local_uuid: string | null;
  matched_medication_local_uuid: string | null;
  created_at: string;
};

async function decryptRow<T>(row: ProfessionalAttestationRow): Promise<ProfessionalAttestation<T>> {
  const payload = (await decryptJson<T>(row.encrypted_payload)) as T;
  return {
    local_id: row.local_id,
    source_envelope_local_id: row.source_envelope_local_id,
    envelope_type: row.envelope_type,
    payload,
    matched_allergy_local_uuid: row.matched_allergy_local_uuid,
    matched_diagnosis_local_uuid: row.matched_diagnosis_local_uuid,
    matched_medication_local_uuid: row.matched_medication_local_uuid,
    created_at: row.created_at,
  };
}

export async function insert(params: {
  localId: string;
  sourceEnvelopeLocalId: string;
  envelopeType: string;
  payload: unknown;
  matchedAllergyLocalUuid: string | null;
  matchedDiagnosisLocalUuid: string | null;
  matchedMedicationLocalUuid: string | null;
}): Promise<void> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const encryptedPayload = await encryptJson(params.payload);
  await db.runAsync(
    `INSERT INTO professional_attestations
       (local_id, user_id, source_envelope_local_id, envelope_type, encrypted_payload, matched_allergy_local_uuid, matched_diagnosis_local_uuid, matched_medication_local_uuid, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params.localId,
    userId,
    params.sourceEnvelopeLocalId,
    params.envelopeType,
    encryptedPayload,
    params.matchedAllergyLocalUuid,
    params.matchedDiagnosisLocalUuid,
    params.matchedMedicationLocalUuid,
    new Date().toISOString(),
  );
}

export async function getAll<T = unknown>(): Promise<ProfessionalAttestation<T>[]> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const rows = await db.getAllAsync<ProfessionalAttestationRow>(
    'SELECT * FROM professional_attestations WHERE user_id = ? ORDER BY created_at DESC',
    userId,
  );
  return Promise.all(rows.map((row) => decryptRow<T>(row)));
}

export async function getForAllergy<T = unknown>(allergenLocalUuid: string): Promise<ProfessionalAttestation<T>[]> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const rows = await db.getAllAsync<ProfessionalAttestationRow>(
    'SELECT * FROM professional_attestations WHERE user_id = ? AND matched_allergy_local_uuid = ? ORDER BY created_at DESC',
    userId,
    allergenLocalUuid,
  );
  return Promise.all(rows.map((row) => decryptRow<T>(row)));
}

export async function getForDiagnosis<T = unknown>(diagnosisLocalUuid: string): Promise<ProfessionalAttestation<T>[]> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const rows = await db.getAllAsync<ProfessionalAttestationRow>(
    'SELECT * FROM professional_attestations WHERE user_id = ? AND matched_diagnosis_local_uuid = ? ORDER BY created_at DESC',
    userId,
    diagnosisLocalUuid,
  );
  return Promise.all(rows.map((row) => decryptRow<T>(row)));
}

export async function getForMedication<T = unknown>(medicationLocalUuid: string): Promise<ProfessionalAttestation<T>[]> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const rows = await db.getAllAsync<ProfessionalAttestationRow>(
    'SELECT * FROM professional_attestations WHERE user_id = ? AND matched_medication_local_uuid = ? ORDER BY created_at DESC',
    userId,
    medicationLocalUuid,
  );
  return Promise.all(rows.map((row) => decryptRow<T>(row)));
}

/** User-driven manual confirmation for an ambiguous/no-match allergy_verification attestation — never auto-applied (see merge.service.ts). */
export async function setMatchedAllergy(localId: string, allergyLocalUuid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE professional_attestations SET matched_allergy_local_uuid = ? WHERE local_id = ?',
    allergyLocalUuid,
    localId,
  );
}

/** User-driven manual confirmation for an ambiguous/no-match diagnosis_verification attestation — never auto-applied (see merge.service.ts). */
export async function setMatchedDiagnosis(localId: string, diagnosisLocalUuid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE professional_attestations SET matched_diagnosis_local_uuid = ? WHERE local_id = ?',
    diagnosisLocalUuid,
    localId,
  );
}

/** User-driven manual confirmation for an ambiguous/no-match medication_verification attestation — never auto-applied (see merge.service.ts). */
export async function setMatchedMedication(localId: string, medicationLocalUuid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE professional_attestations SET matched_medication_local_uuid = ? WHERE local_id = ?',
    medicationLocalUuid,
    localId,
  );
}
