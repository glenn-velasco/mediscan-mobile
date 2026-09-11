import { decode } from '@/api/encrypted-crud';
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
  const payload = medical ? await decryptJson<Omit<MedicalInformationSyncRecord, 'id' | 'updated_at'>>(medical.encrypted_payload) : null;
  return {
    server_time: result.server_time,
    medical_information: payload ? { ...payload, id: 1, updated_at: medical!.updated_at } : null,
    allergies: await Promise.all(result.allergies.map((row) => decode<AllergyApiRecord>(row as never))),
    conditions: await Promise.all(result.conditions.map((row) => decode<ConditionApiRecord>(row as never))),
    diagnoses: await Promise.all(result.diagnoses.map((row) => decode<DiagnosisApiRecord>(row as never))),
    medications: await Promise.all(result.medications.map((row) => decode<MedicationApiRecord>(row as never))),
    emergency_contacts: await Promise.all(result.emergency_contacts.map((row) => decode<EmergencyContactApiRecord>(row as never))),
  };
}
