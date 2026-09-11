import { requireAuthUserId, supabase, throwSupabaseError } from '@/api/supabase';
import { encryptJson } from '@/lib/crypto';
import type { MedicalInformationPayload } from '@/api/types';
import type { MedicalInformationSyncRecord } from '@/api/endpoints/sync';

// Only the fields this app actually reads off MedicalInformationResource — its full shape (fullname,
// linked_user_count, contacts, transfusion_consents, created_at) differs from the /sync endpoint's
// MedicalInformationSyncRecord, so this is deliberately its own narrower type, not an extension of it.
export type MedicalInformationApiRecord = { id: number; avatar: string | null };

/** Bridges the one remaining shape mismatch between the mobile payload and the server's request body: `date_of_birth` (mobile) <-> `dob` (server). `address` is already structured on both sides. */
function toServerPayload(payload: MedicalInformationPayload) {
  return {
    first_name: payload.first_name,
    middle_name: payload.middle_name ?? null,
    last_name: payload.last_name,
    suffix: payload.suffix ?? null,
    dob: payload.date_of_birth,
    gender: payload.gender,
    blood_type: payload.blood_type ?? null,
    religion: payload.religion ?? null,
    address: payload.address ?? null,
    no_blood_transfusion: payload.no_blood_transfusion ?? false,
  };
}

export function createMedicalInformation(payload: MedicalInformationPayload) {
  return saveMedicalInformation(payload);
}

export function updateMedicalInformation(id: number, payload: MedicalInformationPayload) {
  return saveMedicalInformation(payload);
}

async function saveMedicalInformation(payload: MedicalInformationPayload): Promise<MedicalInformationSyncRecord> {
  const user_id = await requireAuthUserId();
  const normalized = toServerPayload(payload);
  const encrypted_payload = await encryptJson(normalized);
  const updated_at = new Date().toISOString();
  const { error } = await supabase.from('medical_information').upsert({ user_id, encrypted_payload, updated_at }, { onConflict: 'user_id' });
  if (error) throwSupabaseError(error);
  return { id: 1, national_id: null, updated_at, ...normalized } as MedicalInformationSyncRecord;
}

/** The authenticated user's own linked medical information record, including its `avatar` URL. */
export async function getMedicalInformation() {
  const userId = await requireAuthUserId();
  const { error } = await supabase.from('medical_information').select('id').eq('user_id', userId).maybeSingle();
  if (error) throwSupabaseError(error);
  const { data: profile } = await supabase.from('profiles').select('avatar_path').eq('id', userId).single();
  const avatarPath = (profile?.avatar_path as string | null) ?? null;
  if (!avatarPath) return { id: 1, avatar: null };
  const { data: signed, error: signedError } = await supabase.storage.from('avatars').createSignedUrl(avatarPath, 3600);
  if (signedError) throwSupabaseError(signedError);
  return { id: 1, avatar: signed.signedUrl };
}

export async function uploadMedicalInformationAvatar(_id: number, formData: FormData) {
  const userId = await requireAuthUserId();
  const file = formData.get('avatar');
  if (!(file instanceof Blob)) throw new Error('Avatar is required');
  const path = `${userId}/avatar-${Date.now()}`;
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type || 'image/jpeg' });
  if (error) throwSupabaseError(error);
  const { error: profileError } = await supabase.from('profiles').update({ avatar_path: path, updated_at: new Date().toISOString() }).eq('id', userId);
  if (profileError) throwSupabaseError(profileError);
  const { data: signed, error: signedError } = await supabase.storage.from('avatars').createSignedUrl(path, 3600);
  if (signedError) throwSupabaseError(signedError);
  return { id: 1, avatar: signed.signedUrl };
}
