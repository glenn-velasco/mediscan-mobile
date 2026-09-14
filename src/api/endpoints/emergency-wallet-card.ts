import { invokeFunction } from '@/api/supabase';
import type { EmergencyFieldChange } from '@/db/repositories/emergency-field-history.repo';

export type DynamicCardStatus = {
  active: boolean;
  issued_at?: string;
  published_at?: string | null;
  snapshot_generated_at?: string | null;
};

export async function createEmergencyCard(): Promise<{ token: string; issued_at: string }> {
  return invokeFunction('emergency-card-create');
}

export async function getEmergencyCardStatus(): Promise<DynamicCardStatus> {
  return invokeFunction('emergency-card-status');
}

export async function publishEmergencyCard(qrPayload: string, snapshotGeneratedAt: string): Promise<{ published_at: string }> {
  return invokeFunction('emergency-card-publish', {
    qr_payload: qrPayload,
    snapshot_generated_at: snapshotGeneratedAt,
  });
}

export async function revokeEmergencyCard(): Promise<void> {
  return invokeFunction('emergency-card-revoke');
}

export async function resolveEmergencyCard(token: string): Promise<{
  qr_payload: string;
  snapshot_generated_at: string;
  published_at: string;
  recent_history?: EmergencyFieldChange[];
}> {
  return invokeFunction('emergency-card-resolve', { token });
}
