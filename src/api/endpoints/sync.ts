import { migrateLegacyMedicalInformation, openPatientPayloads } from '@/api/patient-cloud-crypto';
import { requireAuthUserId, supabase, throwSupabaseError } from '@/api/supabase';
import { decryptJson } from '@/lib/crypto';
import type { AllergyApiRecord } from '@/api/endpoints/allergies';
import type { ConditionApiRecord } from '@/api/endpoints/conditions';
import type { DiagnosisApiRecord } from '@/api/endpoints/diagnoses';
import type { MedicationApiRecord } from '@/api/endpoints/medications';
import type { EmergencyContactApiRecord } from '@/api/endpoints/emergency-contacts';
import type { MedicalInformationAddress } from '@/api/types';

export type MedicalInformationSyncRecord = {
  id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  dob: string;
  gender: string;
  blood_type: string | null;
  religion: string | null;
  national_id: string | null;
  phone_country_code: string | null;
  phone: string | null;
  address: MedicalInformationAddress | null;
  no_blood_transfusion: boolean;
  updated_at: string;
};

export type SyncResponse = {
  server_time: string;
  medical_information: MedicalInformationSyncRecord | null;
  medical_information_state: 'missing' | 'current' | 'legacy-recovered' | 'legacy-unavailable';
  unreadable_peer_records: number;
  allergies: AllergyApiRecord[];
  conditions: ConditionApiRecord[];
  diagnoses: DiagnosisApiRecord[];
  medications: MedicationApiRecord[];
  emergency_contacts: EmergencyContactApiRecord[];
};

type MedicalInformationPayload = Omit<MedicalInformationSyncRecord, 'id' | 'updated_at' | 'national_id'>;
type EncryptedSyncRow = {
  id: string;
  encrypted_payload: string;
  deleted_at: string | null;
  updated_at: string;
};

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isMedicalInformationPayload(value: unknown): value is MedicalInformationPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.first_name === 'string'
    && isNullableString(record.middle_name)
    && typeof record.last_name === 'string'
    && isNullableString(record.suffix)
    && typeof record.dob === 'string'
    && typeof record.gender === 'string'
    && (record.phone_country_code === undefined || isNullableString(record.phone_country_code))
    && (record.phone === undefined || isNullableString(record.phone))
    && isNullableString(record.blood_type)
    && isNullableString(record.religion)
    && (record.address === null || (typeof record.address === 'object' && !Array.isArray(record.address)))
    && typeof record.no_blood_transfusion === 'boolean';
}

/**
 * Decrypts peer records without allowing one damaged ciphertext to reject the entire sync.
 * Healthy batches stay fast; a failed batch is bisected until only the unreadable rows are skipped.
 */
type PeerPayloadOpenResult = {
  valuesByCiphertext: Map<string, unknown>;
  unreadableCount: number;
};

function isIsolatablePeerDecryptError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { message?: unknown; status?: unknown };
  if (candidate.status !== 400 || typeof candidate.message !== 'string') return false;

  // The shared Edge Function reports malformed or unauthentic ciphertext as HTTP 400. Keep this
  // allowlist narrow: configuration errors and unexpected server failures must abort the pull.
  return /unsupported patient record encryption version|invalid patient record(?:\s*\(http 400\))?$|operation-specific reason|decrypt|ciphertext|base64|\batob\b|invalid character|json|unexpected (?:token|end)|expected property name/i
    .test(candidate.message);
}

async function openPeerPayloads(ciphertexts: string[]): Promise<PeerPayloadOpenResult> {
  const valuesByCiphertext = new Map<string, unknown>();
  let unreadableCount = 0;

  const openRange = async (range: string[]): Promise<void> => {
    if (!range.length) return;
    try {
      const values = await openPatientPayloads<unknown>(range);
      range.forEach((ciphertext, index) => valuesByCiphertext.set(ciphertext, values[index]));
    } catch (error) {
      if (!isIsolatablePeerDecryptError(error)) throw error;
      if (range.length === 1) {
        unreadableCount += 1;
        console.warn('[PatientSync] Skipped one unreadable encrypted peer record');
        return;
      }
      const middle = Math.ceil(range.length / 2);
      await openRange(range.slice(0, middle));
      await openRange(range.slice(middle));
    }
  };

  for (let index = 0; index < ciphertexts.length; index += 100) {
    await openRange(ciphertexts.slice(index, index + 100));
  }
  return { valuesByCiphertext, unreadableCount };
}

/** GET /sync?since= — see the backend repo's docs/SYNC.md. Omit `since` to pull everything. */
export function pullSync(since?: string) {
  return pullSupabaseSync(since);
}

async function pullSupabaseSync(since?: string): Promise<SyncResponse> {
  await requireAuthUserId();
  const { data, error } = await supabase.rpc('sync_patient_data', {
    since_timestamp: since ?? null,
  });
  if (error) throwSupabaseError(error);
  const result = data as {
    server_time: string;
    medical_information: { encrypted_payload: string; updated_at: string } | null;
    allergies: unknown[];
    conditions: unknown[];
    diagnoses: unknown[];
    medications: unknown[];
    emergency_contacts: unknown[];
  };
  const medical = result.medical_information;
  let currentMedicalInformation: MedicalInformationSyncRecord | null = null;
  let legacyMedicalInformation: MedicalInformationSyncRecord | null = null;
  let medicalInformationState: SyncResponse['medical_information_state'] = medical ? 'legacy-unavailable' : 'missing';

  if (medical?.encrypted_payload.startsWith('gcm1:')) {
    // The medical profile is the recovery-critical record. Open it independently so a damaged
    // allergy/condition/etc. can never prevent the profile itself from hydrating after login.
    const [currentPayload] = await openPatientPayloads<unknown>([medical.encrypted_payload]);
    if (!isMedicalInformationPayload(currentPayload)) {
      throw new Error('Invalid medical profile payload');
    }
    currentMedicalInformation = {
      ...currentPayload,
      phone_country_code: currentPayload.phone_country_code ?? null,
      phone: currentPayload.phone ?? null,
      id: 1,
      national_id: null,
      updated_at: medical.updated_at,
    };
    medicalInformationState = 'current';
  } else if (medical) {
    try {
      const legacyPayload = await decryptJson<unknown>(medical.encrypted_payload);
      if (isMedicalInformationPayload(legacyPayload)) {
        const normalized = {
          ...legacyPayload,
          phone_country_code: legacyPayload.phone_country_code ?? null,
          phone: legacyPayload.phone ?? null,
        };
        legacyMedicalInformation = {
          ...normalized,
          id: 1,
          national_id: null,
          updated_at: medical.updated_at,
        };
        medicalInformationState = 'legacy-recovered';
        try {
          await migrateLegacyMedicalInformation(medical.encrypted_payload, normalized);
        } catch {
          // The local recovery still succeeds. A later sync can retry the guarded cloud upgrade.
          console.warn('[PatientSync] Legacy medical profile recovered locally; cloud upgrade deferred');
        }
      }
    } catch {
      // This is expected on a different device, which does not possess the legacy device key.
    }
  }
  const sections = ['allergies', 'conditions', 'diagnoses', 'medications', 'emergency_contacts'] as const;
  const flattened = sections.flatMap((section) => result[section]);
  const encryptedRows = flattened as EncryptedSyncRow[];
  // Pre-change development rows were sealed with a device-only key. They cannot be
  // recovered on another device; ignore them instead of blocking every newer row. Tombstones do
  // not need plaintext and must never be allowed to poison hydration with stale ciphertext.
  const ciphertexts = encryptedRows
    .filter((row) => !row.deleted_at && row.encrypted_payload.startsWith('gcm1:'))
    .map((row) => row.encrypted_payload);
  const { valuesByCiphertext, unreadableCount } = await openPeerPayloads(ciphertexts);
  const take = <T extends object>(section: typeof sections[number]): T[] => {
    const rows = result[section] as EncryptedSyncRow[];
    return rows.filter((row) => row.deleted_at
      || (row.encrypted_payload.startsWith('gcm1:') && valuesByCiphertext.has(row.encrypted_payload)))
      .map((row) => ({
        ...(valuesByCiphertext.get(row.encrypted_payload) as T | undefined),
        id: row.id, deleted_at: row.deleted_at, updated_at: row.updated_at,
      } as T));
  };
  return {
    server_time: result.server_time,
    medical_information: currentMedicalInformation ?? legacyMedicalInformation,
    medical_information_state: medicalInformationState,
    unreadable_peer_records: unreadableCount,
    allergies: take<AllergyApiRecord>('allergies'),
    conditions: take<ConditionApiRecord>('conditions'),
    diagnoses: take<DiagnosisApiRecord>('diagnoses'),
    medications: take<MedicationApiRecord>('medications'),
    emergency_contacts: take<EmergencyContactApiRecord>('emergency_contacts'),
  };
}
