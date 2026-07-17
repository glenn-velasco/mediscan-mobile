import type { Gender } from '@/constants/gender';
import type { BloodType } from '@/constants/blood-type';
import type { Suffix } from '@/constants/suffix';
import type { DiagnosisSeverity } from '@/constants/diagnosis-severity';

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'conflict';
export type AllergySyncStatus = SyncStatus | 'failed' | 'deleted_pending';

/** The PHI fields that get AES-encrypted into `encrypted_data` rather than stored as plain columns. */
export type MedicalInformationEncryptedFields = {
  full_name: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: Suffix | null;
  date_of_birth: string | null;
  gender: Gender | null;
  phone_country_code: string | null;
  phone: string | null;
  blood_type: BloodType | null;
  religion: string | null;
  address: string | null;
  no_blood_transfusion: 0 | 1;
};

/** The actual SQLite row shape — PHI lives only in the encrypted blob. */
export type MedicalInformationRawRow = {
  user_id: number;
  server_id: number | null;
  email: string;
  encrypted_data: string;
  sync_status: SyncStatus;
  updated_at_local: string;
  server_updated_at: string | null;
};

/** The decrypted shape repos return to the rest of the app — unchanged from before encryption was added. */
export type MedicalInformationRow = MedicalInformationEncryptedFields & {
  user_id: number;
  server_id: number | null;
  email: string;
  sync_status: SyncStatus;
  updated_at_local: string;
  server_updated_at: string | null;
};

export type AllergyEncryptedFields = {
  allergen: string;
  reaction: string | null;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
};

export type AllergyRawRow = {
  local_uuid: string;
  user_id: number;
  server_id: number | null;
  encrypted_data: string;
  sync_status: AllergySyncStatus;
  deleted_locally: 0 | 1;
  updated_at_local: string;
};

export type AllergyRow = AllergyEncryptedFields & {
  local_uuid: string;
  user_id: number;
  server_id: number | null;
  sync_status: AllergySyncStatus;
  deleted_locally: 0 | 1;
  updated_at_local: string;
};

export type EmergencyContactEncryptedFields = {
  name: string;
  relationship: string | null;
  phone_country_code: string | null;
  phone: string | null;
  is_primary: 0 | 1;
};

export type EmergencyContactRawRow = {
  local_uuid: string;
  user_id: number;
  server_id: number | null;
  encrypted_data: string;
  sync_status: AllergySyncStatus;
  deleted_locally: 0 | 1;
  updated_at_local: string;
};

export type EmergencyContactRow = EmergencyContactEncryptedFields & {
  local_uuid: string;
  user_id: number;
  server_id: number | null;
  sync_status: AllergySyncStatus;
  deleted_locally: 0 | 1;
  updated_at_local: string;
};

export type DiagnosisEncryptedFields = {
  condition: string;
  date_of_diagnosis: string | null;
  severity: DiagnosisSeverity;
};

export type DiagnosisRawRow = {
  local_uuid: string;
  user_id: number;
  server_id: number | null;
  encrypted_data: string;
  sync_status: AllergySyncStatus;
  deleted_locally: 0 | 1;
  updated_at_local: string;
};

export type DiagnosisRow = DiagnosisEncryptedFields & {
  local_uuid: string;
  user_id: number;
  server_id: number | null;
  sync_status: AllergySyncStatus;
  deleted_locally: 0 | 1;
  updated_at_local: string;
};

export type MedicationEncryptedFields = {
  name: string;
  dosage: string;
  frequency: string;
  notes: string | null;
};

export type MedicationRawRow = {
  local_uuid: string;
  user_id: number;
  server_id: number | null;
  encrypted_data: string;
  sync_status: AllergySyncStatus;
  deleted_locally: 0 | 1;
  updated_at_local: string;
};

export type MedicationRow = MedicationEncryptedFields & {
  local_uuid: string;
  user_id: number;
  server_id: number | null;
  sync_status: AllergySyncStatus;
  deleted_locally: 0 | 1;
  updated_at_local: string;
};

export type DeviceKeyRow = {
  user_id: number;
  server_device_key_id: number | null;
  public_key: string;
  label: string | null;
  is_active: 0 | 1;
  registered_at: string | null;
  pending_revoke_server_id: number | null;
  updated_at_local: string;
};

export type EnvelopeTransport = 'relay' | 'ble';
export type PendingSyncEnvelopeStatus =
  | 'received'
  | 'decrypted'
  | 'merged'
  | 'acked'
  | 'decrypt_failed'
  | 'expired'
  | 'discarded';

export type PendingSyncEnvelopeRow = {
  local_id: string;
  user_id: number;
  server_envelope_id: number | null;
  transport: EnvelopeTransport;
  sender_id: number | null;
  envelope_type: string;
  ciphertext: string;
  status: PendingSyncEnvelopeStatus;
  decrypt_error: string | null;
  expires_at: string | null;
  created_at: string;
  processed_at: string | null;
};

export type ProfessionalAttestationRow = {
  local_id: string;
  user_id: number;
  source_envelope_local_id: string;
  envelope_type: string;
  encrypted_payload: string;
  matched_allergy_local_uuid: string | null;
  matched_diagnosis_local_uuid: string | null;
  matched_medication_local_uuid: string | null;
  created_at: string;
};
