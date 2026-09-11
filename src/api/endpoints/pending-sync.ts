import { requireAuthUserId, supabase, throwSupabaseError } from '@/api/supabase';
import type { PendingSyncEnvelope } from '@/api/types';

export async function getPendingSync() {
  const userId = await requireAuthUserId();
  const { data, error } = await supabase.from('encrypted_envelopes').select('*').eq('recipient_id', userId).is('acknowledged_at', null).gt('expires_at', new Date().toISOString());
  if (error) throwSupabaseError(error);
  return { envelopes: (data ?? []) as PendingSyncEnvelope[] };
}

export async function ackEnvelope(envelopeId: string | number) {
  const { error } = await supabase.from('encrypted_envelopes').update({ acknowledged_at: new Date().toISOString() }).eq('id', envelopeId);
  if (error) throwSupabaseError(error);
  return null;
}
