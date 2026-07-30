import type { MedicalInformationAddress, MedicalInformationPayload } from '@/api/types';
import type { BloodType } from '@/constants/blood-type';
import type { Gender } from '@/constants/gender';
import type { Religion } from '@/constants/religion';
import type { Suffix } from '@/constants/suffix';
import { getDb } from '@/db/client';
import { getCurrentUserId } from '@/db/context';
import type {
  MedicalInformationEncryptedFields,
  MedicalInformationRawRow,
  MedicalInformationRow,
  SyncStatus,
} from '@/db/schema';
import { buildFullName } from '@/lib/build-full-name';
import { decryptField, encryptField } from '@/lib/crypto';
import type { MedicalInformationPatch } from '@/lib/envelope-schema';

async function decryptRow(row: MedicalInformationRawRow): Promise<MedicalInformationRow> {
  return {
    user_id: row.user_id,
    server_id: row.server_id,
    email: row.email,
    sync_status: row.sync_status,
    updated_at_local: row.updated_at_local,
    server_updated_at: row.server_updated_at,
    full_name: (await decryptField(row.full_name)) ?? '',
    first_name: (await decryptField(row.first_name)) ?? '',
    middle_name: await decryptField(row.middle_name),
    last_name: (await decryptField(row.last_name)) ?? '',
    suffix: (await decryptField(row.suffix)) as MedicalInformationRow['suffix'],
    date_of_birth: await decryptField(row.date_of_birth),
    gender: (await decryptField(row.gender)) as MedicalInformationRow['gender'],
    phone_country_code: await decryptField(row.phone_country_code),
    phone: await decryptField(row.phone),
    blood_type: (await decryptField(row.blood_type)) as MedicalInformationRow['blood_type'],
    religion: (await decryptField(row.religion)) as MedicalInformationRow['religion'],
    address: await decryptField(row.address),
    no_blood_transfusion: row.no_blood_transfusion,
  };
}

/** Encrypts every `MedicalInformationEncryptedFields` column ahead of an INSERT/UPDATE. */
async function encryptFields(fields: MedicalInformationEncryptedFields) {
  return {
    full_name: await encryptField(fields.full_name),
    first_name: await encryptField(fields.first_name),
    middle_name: await encryptField(fields.middle_name),
    last_name: await encryptField(fields.last_name),
    suffix: await encryptField(fields.suffix),
    date_of_birth: await encryptField(fields.date_of_birth),
    gender: await encryptField(fields.gender),
    phone_country_code: await encryptField(fields.phone_country_code),
    phone: await encryptField(fields.phone),
    blood_type: await encryptField(fields.blood_type),
    religion: await encryptField(fields.religion),
    address: await encryptField(fields.address),
    no_blood_transfusion: fields.no_blood_transfusion,
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
    address: payload.address ? JSON.stringify(payload.address) : null,
    no_blood_transfusion: payload.no_blood_transfusion ? 1 : 0,
  };

  const encrypted = await encryptFields(fields);

  await db.runAsync(
    `INSERT INTO medical_information (user_id, server_id, email, full_name, first_name, middle_name, last_name, suffix, date_of_birth, gender, phone_country_code, phone, blood_type, religion, address, no_blood_transfusion, sync_status, updated_at_local, server_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       email = excluded.email,
       full_name = excluded.full_name,
       first_name = excluded.first_name,
       middle_name = excluded.middle_name,
       last_name = excluded.last_name,
       suffix = excluded.suffix,
       date_of_birth = excluded.date_of_birth,
       gender = excluded.gender,
       phone_country_code = excluded.phone_country_code,
       phone = excluded.phone,
       blood_type = excluded.blood_type,
       religion = excluded.religion,
       address = excluded.address,
       no_blood_transfusion = excluded.no_blood_transfusion,
       sync_status = excluded.sync_status,
       updated_at_local = excluded.updated_at_local`,
    uid,
    existing?.server_id ?? null,
    payload.email,
    encrypted.full_name,
    encrypted.first_name,
    encrypted.middle_name,
    encrypted.last_name,
    encrypted.suffix,
    encrypted.date_of_birth,
    encrypted.gender,
    encrypted.phone_country_code,
    encrypted.phone,
    encrypted.blood_type,
    encrypted.religion,
    encrypted.address,
    encrypted.no_blood_transfusion,
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
  if (patch.address !== undefined) merged.address = patch.address ? JSON.stringify(patch.address) : null;
  if (patch.no_blood_transfusion !== undefined) merged.no_blood_transfusion = patch.no_blood_transfusion ? 1 : 0;

  if (namePartChanged || patch.middle_name !== undefined || patch.suffix !== undefined) {
    merged.full_name = buildFullName({
      first_name: merged.first_name,
      middle_name: merged.middle_name ?? undefined,
      last_name: merged.last_name,
      suffix: merged.suffix ?? undefined,
    });
  }

  const encrypted = await encryptFields(merged);

  await db.runAsync(
    `INSERT INTO medical_information (user_id, server_id, email, full_name, first_name, middle_name, last_name, suffix, date_of_birth, gender, phone_country_code, phone, blood_type, religion, address, no_blood_transfusion, sync_status, updated_at_local, server_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       full_name = excluded.full_name,
       first_name = excluded.first_name,
       middle_name = excluded.middle_name,
       last_name = excluded.last_name,
       suffix = excluded.suffix,
       date_of_birth = excluded.date_of_birth,
       gender = excluded.gender,
       phone_country_code = excluded.phone_country_code,
       phone = excluded.phone,
       blood_type = excluded.blood_type,
       religion = excluded.religion,
       address = excluded.address,
       no_blood_transfusion = excluded.no_blood_transfusion,
       sync_status = excluded.sync_status,
       updated_at_local = excluded.updated_at_local`,
    userId,
    existing?.server_id ?? null,
    existing?.email ?? '',
    encrypted.full_name,
    encrypted.first_name,
    encrypted.middle_name,
    encrypted.last_name,
    encrypted.suffix,
    encrypted.date_of_birth,
    encrypted.gender,
    encrypted.phone_country_code,
    encrypted.phone,
    encrypted.blood_type,
    encrypted.religion,
    encrypted.address,
    encrypted.no_blood_transfusion,
    'synced',
    new Date().toISOString(),
    existing?.server_updated_at ?? null,
  );
}

/**
 * Writes a record pulled from `GET /sync`. Unlike the four peer resources, `medical_information`'s
 * local primary key is `user_id`, not a client-generated UUID matching the server's id - the server's
 * numeric `id` is stored in `server_id` instead. Last-write-wins, same as `Allergy.upsertFromServer`
 * et al.: this unconditionally overwrites the local row with what the server returned.
 *
 * The server's `suffix`/`gender`/`blood_type`/`religion` enum values are lowercase snake_case
 * (e.g. "male"), which now matches this app's local `Suffix`/`Gender`/`BloodType`/`Religion` types
 * exactly - see src/constants/{suffix,gender,blood-type,religion}.ts - so no casing normalization
 * is needed here, just a type-level cast from the untyped sync payload.
 */
export async function saveFromServer(record: {
  id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  dob: string;
  gender: string;
  blood_type: string | null;
  religion: string | null;
  phone_country_code?: string | null;
  phone?: string | null;
  address: MedicalInformationAddress | null;
  no_blood_transfusion: boolean;
  updated_at: string;
}): Promise<void> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const existing = await getByUserId(userId);

  const fields: MedicalInformationEncryptedFields = {
    full_name: buildFullName({
      first_name: record.first_name,
      middle_name: record.middle_name ?? undefined,
      last_name: record.last_name,
      suffix: (record.suffix as Suffix | null) ?? undefined,
    }),
    first_name: record.first_name,
    middle_name: record.middle_name,
    last_name: record.last_name,
    suffix: record.suffix as Suffix | null,
    date_of_birth: record.dob,
    gender: record.gender as Gender,
    phone_country_code: record.phone_country_code ?? existing?.phone_country_code ?? null,
    phone: record.phone ?? existing?.phone ?? null,
    blood_type: record.blood_type as BloodType | null,
    religion: record.religion as Religion | null,
    address: record.address ? JSON.stringify(record.address) : null,
    no_blood_transfusion: record.no_blood_transfusion ? 1 : 0,
  };

  const encrypted = await encryptFields(fields);

  await db.runAsync(
    `INSERT INTO medical_information (user_id, server_id, email, full_name, first_name, middle_name, last_name, suffix, date_of_birth, gender, phone_country_code, phone, blood_type, religion, address, no_blood_transfusion, sync_status, updated_at_local, server_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        server_id = excluded.server_id,
        full_name = excluded.full_name,
        first_name = excluded.first_name,
        middle_name = excluded.middle_name,
        last_name = excluded.last_name,
        suffix = excluded.suffix,
        date_of_birth = excluded.date_of_birth,
        gender = excluded.gender,
        phone_country_code = excluded.phone_country_code,
        phone = excluded.phone,
        blood_type = excluded.blood_type,
        religion = excluded.religion,
        address = excluded.address,
        no_blood_transfusion = excluded.no_blood_transfusion,
        sync_status = 'synced',
        updated_at_local = excluded.updated_at_local,
        server_updated_at = excluded.server_updated_at`,
    userId,
    record.id,
    existing?.email ?? '',
    encrypted.full_name,
    encrypted.first_name,
    encrypted.middle_name,
    encrypted.last_name,
    encrypted.suffix,
    encrypted.date_of_birth,
    encrypted.gender,
    encrypted.phone_country_code,
    encrypted.phone,
    encrypted.blood_type,
    encrypted.religion,
    encrypted.address,
    encrypted.no_blood_transfusion,
    record.updated_at,
    record.updated_at,
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
    address: parseStoredAddress(row.address),
    no_blood_transfusion: !!row.no_blood_transfusion,
  };
}

/** The local column stores the address as a JSON-stringified blob (see `encryptFields`/`decryptRow`); this parses it back into the structured shape the rest of the app expects. */
export function parseStoredAddress(raw: string | null): MedicalInformationAddress | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as MedicalInformationAddress;
  } catch {
    // fall through
  }
  return undefined;
}
