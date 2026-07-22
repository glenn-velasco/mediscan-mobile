import { apiClient } from '@/api/client';
import type { MedicalInformationPayload } from '@/api/types';
import type { MedicalInformationSyncRecord } from '@/api/endpoints/sync';

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
