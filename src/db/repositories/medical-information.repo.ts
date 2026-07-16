import { getDb } from '@/db/client';
import { getCurrentUserId } from '@/db/context';
import { encryptJson, decryptJson } from '@/lib/crypto';
import { buildFullName } from '@/lib/build-full-name';
import type { MedicalInformationPatch } from '@/lib/envelope-schema';
import type {
  MedicalInformationEncryptedFields,
  MedicalInformationRawRow,
  MedicalInformationRow,
  SyncStatus,
} from '@/db/schema';
import type { MedicalInformationPayload } from '@/api/types';

async function decryptRow(row: MedicalInformationRawRow): Promise<MedicalInformationRow> {
  const fields = (await decryptJson<MedicalInformationEncryptedFields>(row.encrypted_data)) ?? {
    full_name: '',
    first_name: '',
    middle_name: null,
    last_name: '',
    suffix: null,
    date_of_birth: null,
    gender: null,
    phone_country_code: null,
    phone: null,
    blood_type: null,
    religion: null,
    address: null,
    no_blood_transfusion: 0,
  };

  return {
    user_id: row.user_id,
    server_id: row.server_id,
    email: row.email,
    sync_status: row.sync_status,
    updated_at_local: row.updated_at_local,
    server_updated_at: row.server_updated_at,
    ...fields,
  };
}

export async function getLocal(): Promise<MedicalInformationRow | null> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const raw = await db.getFirstAsync<MedicalInformationRawRow>(
    'SELECT * FROM medical_information WHERE user_id = ?',
    userId,
  );
  return raw ? decryptRow(raw) : null;
}

export async function getByUserId(userId: number): Promise<MedicalInformationRow | null> {
  const db = await getDb();
  const raw = await db.getFirstAsync<MedicalInformationRawRow>(
    'SELECT * FROM medical_information WHERE user_id = ?',
    userId,
  );
  return raw ? decryptRow(raw) : null;
}

export async function saveLocalEdit(
  payload: MedicalInformationPayload,
  status: SyncStatus = 'synced',
  userId?: number,
): Promise<void> {
  const db = await getDb();
  const uid = userId ?? getCurrentUserId();
  const existing = await getByUserId(uid);

  const fields: MedicalInformationEncryptedFields = {
    full_name: buildFullName(payload),
    first_name: payload.first_name,
    middle_name: payload.middle_name ?? null,
    last_name: payload.last_name,
    suffix: payload.suffix ?? null,
    date_of_birth: payload.date_of_birth ?? null,
    gender: payload.gender ?? null,
    phone_country_code: payload.phone_country_code ?? null,
    phone: payload.phone ?? null,
    blood_type: payload.blood_type ?? null,
    religion: payload.religion ?? null,
    address: payload.address ?? null,
    no_blood_transfusion: payload.no_blood_transfusion ? 1 : 0,
  };

  const encryptedData = await encryptJson(fields);

  await db.runAsync(
    `INSERT INTO medical_information (user_id, server_id, email, encrypted_data, sync_status, updated_at_local, server_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       email = excluded.email,
       encrypted_data = excluded.encrypted_data,
       sync_status = excluded.sync_status,
       updated_at_local = excluded.updated_at_local`,
    uid,
    existing?.server_id ?? null,
    payload.email,
    encryptedData,
    status,
    new Date().toISOString(),
    existing?.server_updated_at ?? null,
  );
}

export async function applyProfessionalUpdate(patch: MedicalInformationPatch): Promise<void> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const existing = await getByUserId(userId);

  const current: MedicalInformationEncryptedFields = existing
    ? {
        full_name: existing.full_name,
        first_name: existing.first_name,
        middle_name: existing.middle_name,
        last_name: existing.last_name,
        suffix: existing.suffix,
        date_of_birth: existing.date_of_birth,
        gender: existing.gender,
        phone_country_code: existing.phone_country_code,
        phone: existing.phone,
        blood_type: existing.blood_type,
        religion: existing.religion,
        address: existing.address,
        no_blood_transfusion: existing.no_blood_transfusion,
      }
    : {
        full_name: '',
        first_name: '',
        middle_name: null,
        last_name: '',
        suffix: null,
        date_of_birth: null,
        gender: null,
        phone_country_code: null,
        phone: null,
        blood_type: null,
        religion: null,
        address: null,
        no_blood_transfusion: 0,
      };

  const merged: MedicalInformationEncryptedFields = { ...current };
  let namePartChanged = false;

  if (patch.first_name !== undefined) { merged.first_name = patch.first_name; namePartChanged = true; }
  if (patch.middle_name !== undefined) merged.middle_name = patch.middle_name;
  if (patch.last_name !== undefined) { merged.last_name = patch.last_name; namePartChanged = true; }
  if (patch.suffix !== undefined) merged.suffix = patch.suffix;
  if (patch.date_of_birth !== undefined) merged.date_of_birth = patch.date_of_birth;
  if (patch.gender !== undefined) merged.gender = patch.gender;
  if (patch.phone_country_code !== undefined) merged.phone_country_code = patch.phone_country_code;
  if (patch.phone !== undefined) merged.phone = patch.phone;
  if (patch.blood_type !== undefined) merged.blood_type = patch.blood_type;
  if (patch.religion !== undefined) merged.religion = patch.religion;
  if (patch.address !== undefined) merged.address = patch.address;
  if (patch.no_blood_transfusion !== undefined) merged.no_blood_transfusion = patch.no_blood_transfusion ? 1 : 0;

  if (namePartChanged || patch.middle_name !== undefined || patch.suffix !== undefined) {
    merged.full_name = buildFullName({
      first_name: merged.first_name,
      middle_name: merged.middle_name ?? undefined,
      last_name: merged.last_name,
      suffix: merged.suffix ?? undefined,
    });
  }

  const encryptedData = await encryptJson(merged);

  await db.runAsync(
    `INSERT INTO medical_information (user_id, server_id, email, encrypted_data, sync_status, updated_at_local, server_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       encrypted_data = excluded.encrypted_data,
       sync_status = excluded.sync_status,
       updated_at_local = excluded.updated_at_local`,
    userId,
    existing?.server_id ?? null,
    existing?.email ?? '',
    encryptedData,
    'synced',
    new Date().toISOString(),
    existing?.server_updated_at ?? null,
  );
}

export async function markSynced(userId?: number): Promise<void> {
  const db = await getDb();
  const uid = userId ?? getCurrentUserId();
  await db.runAsync("UPDATE medical_information SET sync_status = 'synced' WHERE user_id = ?", uid);
}

export async function markConflict(userId?: number): Promise<void> {
  const db = await getDb();
  const uid = userId ?? getCurrentUserId();
  await db.runAsync("UPDATE medical_information SET sync_status = 'conflict' WHERE user_id = ?", uid);
}

export async function clearLocal(userId?: number): Promise<void> {
  const db = await getDb();
  const uid = userId ?? getCurrentUserId();
  await db.runAsync('DELETE FROM medical_information WHERE user_id = ?', uid);
}

export function toPayload(row: MedicalInformationRow): MedicalInformationPayload {
  return {
    email: row.email,
    first_name: row.first_name,
    middle_name: row.middle_name ?? undefined,
    last_name: row.last_name,
    suffix: row.suffix ?? undefined,
    date_of_birth: row.date_of_birth ?? undefined,
    gender: row.gender ?? undefined,
    phone_country_code: row.phone_country_code ?? undefined,
    phone: row.phone ?? undefined,
    blood_type: row.blood_type ?? undefined,
    religion: row.religion ?? undefined,
    address: row.address ?? undefined,
    no_blood_transfusion: !!row.no_blood_transfusion,
  };
}
