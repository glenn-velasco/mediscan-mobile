import { invokeFunction, requireAuthUserId, supabase, throwSupabaseError } from '@/api/supabase';

/** Cloud payloads use a server-held key; the local SQLite key never leaves this device. */
export async function sealPatientPayload(value: unknown): Promise<string> {
  const result = await invokeFunction<{ encrypted_payload: string }>('patient-crypto-seal', { value });
  return result.encrypted_payload;
}

export async function openPatientPayloads<T>(payloads: string[]): Promise<T[]> {
  if (!payloads.length) return [];
  const result = await invokeFunction<{ values: T[] }>('patient-crypto-open', { values: payloads });
  if (!Array.isArray(result.values) || result.values.length !== payloads.length
    || result.values.some((value) => value === null || typeof value !== 'object' || Array.isArray(value))) {
    throw new Error('Incomplete patient record decryption');
  }
  return result.values;
}

/**
 * Re-seals a legacy device-encrypted medical profile with the current server-held key.
 * The ciphertext comparison is an optimistic-concurrency guard: if another client has already
 * upgraded or edited the row, this update matches zero rows instead of overwriting newer data.
 */
export async function migrateLegacyMedicalInformation(originalCiphertext: string, value: unknown): Promise<void> {
  const userId = await requireAuthUserId();
  const encryptedPayload = await sealPatientPayload(value);
  const { error } = await supabase
    .from('medical_information')
    .update({ encrypted_payload: encryptedPayload, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('encrypted_payload', originalCiphertext);
  if (error) throwSupabaseError(error);
}
