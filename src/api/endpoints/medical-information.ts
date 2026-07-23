import { apiClient, postMultipart } from '@/api/client';
import type { MedicalInformationPayload } from '@/api/types';
import type { MedicalInformationSyncRecord } from '@/api/endpoints/sync';

// Only the fields this app actually reads off MedicalInformationResource — its full shape (fullname,
// linked_user_count, contacts, transfusion_consents, created_at) differs from the /sync endpoint's
// MedicalInformationSyncRecord, so this is deliberately its own narrower type, not an extension of it.
export type MedicalInformationApiRecord = { id: number; avatar: string | null };

/** Bridges the one remaining shape mismatch between the mobile payload and the server's request body: `date_of_birth` (mobile) <-> `dob` (server). `address` is already structured on both sides. */
function toServerPayload(payload: MedicalInformationPayload) {
  return {
    first_name: payload.first_name,
    middle_name: payload.middle_name ?? null,
    last_name: payload.last_name,
    suffix: payload.suffix ?? null,
    dob: payload.date_of_birth,
    gender: payload.gender,
    blood_type: payload.blood_type ?? null,
    religion: payload.religion ?? null,
    address: payload.address ?? null,
    no_blood_transfusion: payload.no_blood_transfusion ?? false,
  };
}

export function createMedicalInformation(payload: MedicalInformationPayload) {
  return apiClient.post<MedicalInformationSyncRecord>('api/v1/medical-information', toServerPayload(payload));
}

export function updateMedicalInformation(id: number, payload: MedicalInformationPayload) {
  return apiClient.put<MedicalInformationSyncRecord>(`api/v1/medical-information/${id}`, toServerPayload(payload));
}

/** The authenticated user's own linked medical information record, including its `avatar` URL. */
export function getMedicalInformation() {
  return apiClient.get<MedicalInformationApiRecord>('api/v1/medical-information');
}

export function uploadMedicalInformationAvatar(id: number, formData: FormData) {
  return postMultipart<MedicalInformationApiRecord>(`api/v1/medical-information/${id}/avatar`, formData);
}
