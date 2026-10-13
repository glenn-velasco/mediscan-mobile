import { invokeFunction } from '@/api/supabase';
import type { MedicalInformation, PaginatedResponse, ProfessionalEncounter, ScanNote, ScanSummary } from '@/api/types';
import type { EncounterVital } from '@/types/emergency';

type GetScannedPatientsParams = {
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
};

type ScanSummaryResponse = {
  data: ScanSummary[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
};

export async function getScannedPatients(
  params?: GetScannedPatientsParams,
): Promise<PaginatedResponse<ScanSummary>> {
  const response = await invokeFunction<ScanSummaryResponse>('professional-scans-list', params);
  if (!response) {
    return { data: [], meta: { current_page: 1, last_page: 1, per_page: 15, total: 0 }, links: { first: null, last: null, prev: null, next: null } };
  }
  return {
    data: response.data ?? [],
    meta: response.meta ?? { current_page: 1, last_page: 1, per_page: 15, total: 0 },
    links: response.links ?? { first: null, last: null, prev: null, next: null },
  };
}

export async function getScannedPatientDetail(
  patientId: string | number,
): Promise<MedicalInformation> {
  return invokeFunction<MedicalInformation>('professional-scan-detail', { patient_id: patientId });
}

export async function getScanNotes(
  patientId: string | number,
): Promise<ScanNote | null> {
  try {
    return await invokeFunction<ScanNote>('professional-scan-notes-get', { patient_id: patientId });
  } catch {
    return null;
  }
}

export async function saveScanNotes(
  patientId: string | number,
  notes: string,
): Promise<ScanNote> {
  return invokeFunction<ScanNote>('professional-scan-notes-save', { patient_id: patientId, notes });
}

export function saveProfessionalEncounter(payload: { id?: string; patient_id: string; observations: string; actions_taken: string; vitals: EncounterVital[]; recorded_at: string }) {
  return invokeFunction<ProfessionalEncounter>('professional-encounter-save', payload);
}

export function getProfessionalEncounters(patientId?: string) {
  return invokeFunction<ProfessionalEncounter[]>('professional-encounters-list', patientId ? { patient_id: patientId } : undefined);
}
