import { invokeFunction } from '@/api/supabase';
import type { MedicalInformation, PaginatedResponse, ScanNote, ScanSummary } from '@/api/types';

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
