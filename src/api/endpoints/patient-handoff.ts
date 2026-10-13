import { invokeFunction } from '@/api/supabase';
import type { ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';

export function createPatientHandoffReference(info: ScannedEmergencyInfo, sharedBy: string) {
  return invokeFunction<{ token: string; expires_at: string }>('patient-handoff-create', {
    info,
    shared_by: sharedBy,
  });
}

export function resolvePatientHandoffReference(token: string) {
  return invokeFunction<{
    info: ScannedEmergencyInfo;
    shared_by: string;
    shared_at: string;
    expires_at: string;
  }>('patient-handoff-resolve', { token });
}
