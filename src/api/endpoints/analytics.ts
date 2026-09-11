import { invokeFunction } from '@/api/supabase';

export function logEmergencyQrEvent(payload: { action: 'shown' | 'scanned'; patient_id: string | number; context?: string }) {
  return invokeFunction<null>('audit-emergency-qr', payload);
}
