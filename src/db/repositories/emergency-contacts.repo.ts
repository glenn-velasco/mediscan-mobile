import * as Crypto from 'expo-crypto';

import { getDb } from '@/db/client';
import { getCurrentUserId } from '@/db/context';
import { encryptField, decryptField } from '@/lib/crypto';
import type { EmergencyContactRawRow, EmergencyContactRow } from '@/db/schema';
import type { EmergencyContactPayload } from '@/api/types';
import type { RelationToPatient } from '@/constants/relation-to-patient';

async function decryptRow(row: EmergencyContactRawRow): Promise<EmergencyContactRow> {
  return {
    local_uuid: row.local_uuid,
    user_id: row.user_id,
    server_id: row.server_id,
    sync_status: row.sync_status,
    deleted_locally: row.deleted_locally,
    updated_at_local: row.updated_at_local,
    name: (await decryptField(row.name)) ?? '',
    relationship: row.relationship,
    phone_country_code: row.phone_country_code,
    phone: await decryptField(row.phone),
    is_primary: row.is_primary,
  };
}

export async function getAll(): Promise<EmergencyContactRow[]> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const rows = await db.getAllAsync<EmergencyContactRawRow>(
    'SELECT * FROM emergency_contacts WHERE user_id = ? AND deleted_locally = 0 ORDER BY updated_at_local DESC',
    userId,
  );
  return Promise.all(rows.map(decryptRow));
}

/** Like `getAll()` but includes rows pending a delete-push - the cloud sync push loop needs to see those too, unlike normal UI listings. */
export async function getAllForPush(): Promise<EmergencyContactRow[]> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const rows = await db.getAllAsync<EmergencyContactRawRow>(
    "SELECT * FROM emergency_contacts WHERE user_id = ? AND (server_id IS NULL OR sync_status = 'pending') ORDER BY updated_at_local DESC",
    userId,
  );
  return Promise.all(rows.map(decryptRow));
}

export async function getByLocalUuid(localUuid: string): Promise<EmergencyContactRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<EmergencyContactRawRow>(
    'SELECT * FROM emergency_contacts WHERE local_uuid = ?',
    localUuid,
  );
  return row ? decryptRow(row) : null;
}

export async function createLocal(payload: EmergencyContactPayload): Promise<string> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const localUuid = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO emergency_contacts (local_uuid, user_id, server_id, name, relationship, phone_country_code, phone, is_primary, sync_status, deleted_locally, updated_at_local)
     VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'synced', 0, ?)`,
    localUuid,
    userId,
    await encryptField(payload.name),
    payload.relationship ?? null,
    payload.phone_country_code ?? null,
    await encryptField(payload.phone ?? null),
    payload.is_primary ? 1 : 0,
    now,
  );
  return localUuid;
}

export async function updateLocal(localUuid: string, payload: Partial<EmergencyContactPayload>): Promise<void> {
  const [db, existing] = await Promise.all([getDb(), getByLocalUuid(localUuid)]);
  if (!existing) return;

  await db.runAsync(
    `UPDATE emergency_contacts SET name = ?, relationship = ?, phone_country_code = ?, phone = ?, is_primary = ?, sync_status = 'pending', updated_at_local = ? WHERE local_uuid = ?`,
    await encryptField(payload.name ?? existing.name),
    payload.relationship ?? existing.relationship,
    payload.phone_country_code ?? existing.phone_country_code,
    await encryptField(payload.phone ?? existing.phone),
    payload.is_primary !== undefined ? (payload.is_primary ? 1 : 0) : existing.is_primary,
    new Date().toISOString(),
    localUuid,
  );
}

export async function markSyncedCreate(localUuid: string, serverId: number, expectedUpdatedAt?: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE emergency_contacts SET server_id = ?,
       sync_status = CASE WHEN ? IS NULL OR updated_at_local = ? THEN 'synced' ELSE sync_status END
     WHERE local_uuid = ?`,
    serverId, expectedUpdatedAt ?? null, expectedUpdatedAt ?? null, localUuid,
  );
}
export async function markSynced(localUuid: string, expectedUpdatedAt?: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE emergency_contacts SET sync_status = 'synced' WHERE local_uuid = ? AND (? IS NULL OR updated_at_local = ?)`,
    localUuid, expectedUpdatedAt ?? null, expectedUpdatedAt ?? null,
  );
}

async function markConflict(localUuid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE emergency_contacts SET sync_status = 'conflict' WHERE local_uuid = ?`, localUuid);
}

export async function deleteLocal(localUuid: string): Promise<{ requiresNetworkDelete: boolean }> {
  const [db, existing] = await Promise.all([getDb(), getByLocalUuid(localUuid)]);
  if (!existing) return { requiresNetworkDelete: false };

  if (!existing.server_id) {
    await db.runAsync('DELETE FROM emergency_contacts WHERE local_uuid = ?', localUuid);
    return { requiresNetworkDelete: false };
  }

  await db.runAsync(
    `UPDATE emergency_contacts SET sync_status = 'pending', deleted_locally = 1, updated_at_local = ? WHERE local_uuid = ?`,
    new Date().toISOString(),
    localUuid,
  );
  return { requiresNetworkDelete: true };
}

export async function hardDelete(localUuid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM emergency_contacts WHERE local_uuid = ?', localUuid);
}

async function discardConflict(localUuid: string): Promise<void> {
  const [db, existing] = await Promise.all([getDb(), getByLocalUuid(localUuid)]);
  if (!existing) return;

  if (!existing.server_id) {
    await db.runAsync('DELETE FROM emergency_contacts WHERE local_uuid = ?', localUuid);
    return;
  }

  await db.runAsync(
    `UPDATE emergency_contacts SET sync_status = 'synced', deleted_locally = 0, updated_at_local = ? WHERE local_uuid = ?`,
    new Date().toISOString(),
    localUuid,
  );
}

/** See `allergies.repo.ts`'s `upsertFromServer` for the design rationale - identical shape. */
export async function upsertFromServer(record: {
  id: string;
  name: string;
  relationship?: string;
  phone_country_code?: string;
  phone?: string;
  // Optional, not just `boolean`: mirrors `EmergencyContactPayload.is_primary?`, which the server
  // itself treats as optional/defaultable - a pulled record that omits it just isn't primary.
  is_primary?: boolean;
  updated_at: string;
}): Promise<void> {
  const db = await getDb();
  const userId = getCurrentUserId();

  await db.runAsync(
    `INSERT INTO emergency_contacts (local_uuid, user_id, server_id, name, relationship, phone_country_code, phone, is_primary, sync_status, deleted_locally, updated_at_local)
     VALUES (?, ?, 1, ?, ?, ?, ?, ?, 'synced', 0, ?)
     ON CONFLICT(local_uuid) DO UPDATE SET
       server_id = 1,
       name = excluded.name,
       relationship = excluded.relationship,
       phone_country_code = excluded.phone_country_code,
       phone = excluded.phone,
       is_primary = excluded.is_primary,
       sync_status = 'synced',
       deleted_locally = 0,
       updated_at_local = excluded.updated_at_local
     WHERE sync_status != 'pending' AND deleted_locally = 0`,
    record.id,
    userId,
    await encryptField(record.name),
    record.relationship ?? null,
    record.phone_country_code ?? null,
    await encryptField(record.phone ?? null),
    record.is_primary ? 1 : 0,
    record.updated_at,
  );
}

export function toPayload(row: EmergencyContactRow): EmergencyContactPayload {
  return {
    name: row.name,
    relationship: (row.relationship as RelationToPatient | null) ?? undefined,
    phone_country_code: row.phone_country_code ?? undefined,
    phone: row.phone ?? undefined,
    is_primary: !!row.is_primary,
  };
}
