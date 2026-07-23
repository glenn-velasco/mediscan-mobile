import { apiClient } from '@/api/client';
import type { AllergyApiRecord } from '@/api/endpoints/allergies';
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
  address: MedicalInformationAddress | null;
  no_blood_transfusion: boolean;
  updated_at: string;
};

export type SyncResponse = {
  server_time: string;
  medical_information: MedicalInformationSyncRecord | null;
  allergies: AllergyApiRecord[];
  diagnoses: DiagnosisApiRecord[];
  medications: MedicationApiRecord[];
  emergency_contacts: EmergencyContactApiRecord[];
};

/** GET /sync?since= — see the backend repo's docs/SYNC.md. Omit `since` to pull everything. */
export function pullSync(since?: string) {
  const query = since ? `?since=${encodeURIComponent(since)}` : '';
  return apiClient.get<SyncResponse>(`api/v1/sync${query}`);
}
