import { openPatientPayloads } from '@/api/patient-cloud-crypto';
import { requireAuthUserId, supabase, throwSupabaseError } from '@/api/supabase';
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
  allergies: AllergyApiRecord[];
  conditions: ConditionApiRecord[];
  diagnoses: DiagnosisApiRecord[];
  medications: MedicationApiRecord[];
  emergency_contacts: EmergencyContactApiRecord[];
};

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
  const sections = ['allergies', 'conditions', 'diagnoses', 'medications', 'emergency_contacts'] as const;
  const flattened = sections.flatMap((section) => result[section]);
  const encryptedRows = flattened as { id: string; encrypted_payload: string; deleted_at: string | null; updated_at: string }[];
  // Pre-change development rows were sealed with a device-only key. They cannot be
  // recovered on another device; ignore them instead of blocking every newer row.
  const ciphertexts = [medical?.encrypted_payload, ...encryptedRows.map((row) => row.encrypted_payload)]
    .filter((value): value is string => typeof value === 'string' && value.startsWith('gcm1:'));
  const decoded: unknown[] = [];
  for (let index = 0; index < ciphertexts.length; index += 100) {
    decoded.push(...await openPatientPayloads<unknown>(ciphertexts.slice(index, index + 100)));
  }
  const valuesByCiphertext = new Map(ciphertexts.map((ciphertext, index) => [ciphertext, decoded[index]]));
  const payload = medical?.encrypted_payload.startsWith('gcm1:')
    ? valuesByCiphertext.get(medical.encrypted_payload) as Omit<MedicalInformationSyncRecord, 'id' | 'updated_at'>
    : null;
  const take = <T extends object>(section: typeof sections[number]): T[] => {
    const rows = result[section] as { id: string; encrypted_payload: string; deleted_at: string | null; updated_at: string }[];
    return rows.filter((row) => row.deleted_at || row.encrypted_payload.startsWith('gcm1:'))
      .map((row) => ({
        ...(valuesByCiphertext.get(row.encrypted_payload) as T | undefined),
        id: row.id, deleted_at: row.deleted_at, updated_at: row.updated_at,
      } as T));
  };
  return {
    server_time: result.server_time,
    medical_information: payload ? { ...payload, id: 1, updated_at: medical!.updated_at } : null,
    allergies: take<AllergyApiRecord>('allergies'),
    conditions: take<ConditionApiRecord>('conditions'),
    diagnoses: take<DiagnosisApiRecord>('diagnoses'),
    medications: take<MedicationApiRecord>('medications'),
    emergency_contacts: take<EmergencyContactApiRecord>('emergency_contacts'),
  };
}
