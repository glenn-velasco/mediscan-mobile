import { invokeFunction } from '@/api/supabase';

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
