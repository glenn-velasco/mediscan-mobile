import type { Gender } from '@/constants/gender';
import type { BloodType } from '@/constants/blood-type';
import type { Suffix } from '@/constants/suffix';
import type { DiagnosisSeverity } from '@/constants/diagnosis-severity';

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'conflict';
export type AllergySyncStatus = SyncStatus | 'failed' | 'deleted_pending';

/** The PHI fields, each AES-encrypted into its own column (see migration 011) rather than one whole-row blob. */
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

/** The actual SQLite row shape — every `MedicalInformationEncryptedFields` column holds ciphertext at rest (see `encryptField`/`decryptField` in `src/lib/crypto.ts`), except `no_blood_transfusion` which isn't PHI on its own. */
export type MedicalInformationRawRow = {
  user_id: number;
  server_id: number | null;
  email: string;
  full_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  suffix: string | null;
  date_of_birth: string | null;
  gender: string | null;
  phone_country_code: string | null;
  phone: string | null;
  blood_type: string | null;
  religion: string | null;
  address: string | null;
  no_blood_transfusion: 0 | 1;
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

/** `allergen`/`reaction` hold ciphertext at rest; `severity` is a bounded enum, stored plaintext (see migration 011's table comment). */
export type AllergyRawRow = {
  local_uuid: string;
  user_id: number;
  server_id: number | null;
  allergen: string;
  reaction: string | null;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
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

/** `name`/`phone` hold ciphertext at rest; `relationship`/`phone_country_code`/`is_primary` are bounded/non-identifying, stored plaintext. */
export type EmergencyContactRawRow = {
  local_uuid: string;
  user_id: number;
  server_id: number | null;
  name: string;
  relationship: string | null;
  phone_country_code: string | null;
  phone: string | null;
  is_primary: 0 | 1;
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

/** `condition` holds ciphertext at rest; `date_of_diagnosis`/`severity` are stored plaintext (see migration 011's table comment). */
export type DiagnosisRawRow = {
  local_uuid: string;
  user_id: number;
  server_id: number | null;
  condition: string;
  date_of_diagnosis: string | null;
  severity: DiagnosisSeverity;
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

/** `name`/`dosage`/`notes` hold ciphertext at rest; `frequency` is short structured text, stored plaintext. */
export type MedicationRawRow = {
  local_uuid: string;
  user_id: number;
  server_id: number | null;
  name: string;
  dosage: string;
  frequency: string;
  notes: string | null;
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
