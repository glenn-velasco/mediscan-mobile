import { requireAuthUserId, supabase, throwSupabaseError } from '@/api/supabase';
import { decryptJson, encryptJson } from '@/lib/crypto';

type CloudRow = { id: string; encrypted_payload: string; deleted_at: string | null; updated_at: string };

export async function createEncrypted<T extends object>(table: string, id: string, payload: T): Promise<T & Pick<CloudRow, 'id' | 'deleted_at' | 'updated_at'>> {
  const user_id = await requireAuthUserId();
  const encrypted_payload = await encryptJson(payload);
  const { data, error } = await supabase.from(table).insert({ id, user_id, encrypted_payload }).select().single();
  if (error) throwSupabaseError(error);
  return decode<T>(data as CloudRow);
}

export async function updateEncrypted<T extends object>(table: string, id: string, payload: T): Promise<T & Pick<CloudRow, 'id' | 'deleted_at' | 'updated_at'>> {
  const encrypted_payload = await encryptJson(payload);
  const { data, error } = await supabase.from(table).update({ encrypted_payload, deleted_at: null, updated_at: new Date().toISOString() }).eq('id', id).select().single();
  if (error) throwSupabaseError(error);
  return decode<T>(data as CloudRow);
}

export async function softDeleteEncrypted(table: string, id: string): Promise<null> {
  const { error } = await supabase.from(table).update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throwSupabaseError(error);
  return null;
}

export async function decode<T extends object>(row: CloudRow): Promise<T & Pick<CloudRow, 'id' | 'deleted_at' | 'updated_at'>> {
  const payload = await decryptJson<T>(row.encrypted_payload);
  if (!payload) throw new Error(`Unable to decrypt ${row.id}`);
  return { ...payload, id: row.id, deleted_at: row.deleted_at, updated_at: row.updated_at };
}
