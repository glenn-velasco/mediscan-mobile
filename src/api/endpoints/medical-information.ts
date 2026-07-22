import { apiClient } from '@/api/client';
import type { MedicalInformationPayload } from '@/api/types';
import type { MedicalInformationSyncRecord } from '@/api/endpoints/sync';

/**
 * Bridges two shape mismatches between the mobile payload and the server's request body:
 * - `date_of_birth` (mobile) <-> `dob` (server)
 * - `address` is a single opaque string locally (never structured on this side) but the server
 *   expects `{ province, street, unit, country, postal_code, city }`. Mobile's local column stores
 *   whatever JSON string was last pulled from the server (see medical-information.repo.ts's
 *   `saveFromServer`), so this parses it back out; a value that was never a JSON object (e.g. a
 *   plain string a user typed before this bridge existed) is sent as `null` rather than guessed at.
 */
function toServerPayload(payload: MedicalInformationPayload) {
  let address: Record<string, unknown> | null = null;
  if (payload.address) {
    try {
      const parsed = JSON.parse(payload.address);
      if (parsed && typeof parsed === 'object') address = parsed;
    } catch {
      address = null;
    }
  }

  return {
    first_name: payload.first_name,
    middle_name: payload.middle_name ?? null,
    last_name: payload.last_name,
    suffix: payload.suffix ?? null,
    dob: payload.date_of_birth,
    gender: payload.gender,
    blood_type: payload.blood_type ?? null,
    religion: payload.religion ?? null,
    address,
    no_blood_transfusion: payload.no_blood_transfusion ?? false,
  };
}

export function createMedicalInformation(payload: MedicalInformationPayload) {
  return apiClient.post<MedicalInformationSyncRecord>('api/v1/medical-information', toServerPayload(payload));
}

export function updateMedicalInformation(id: number, payload: MedicalInformationPayload) {
  return apiClient.put<MedicalInformationSyncRecord>(`api/v1/medical-information/${id}`, toServerPayload(payload));
}
