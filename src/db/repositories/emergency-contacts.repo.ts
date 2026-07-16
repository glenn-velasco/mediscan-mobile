import * as Crypto from 'expo-crypto';

import { getDb } from '@/db/client';
import { getCurrentUserId } from '@/db/context';
import { encryptJson, decryptJson } from '@/lib/crypto';
import type { EmergencyContactEncryptedFields, EmergencyContactRawRow, EmergencyContactRow } from '@/db/schema';
import type { EmergencyContactPayload } from '@/api/types';

async function decryptRow(row: EmergencyContactRawRow): Promise<EmergencyContactRow> {
  const fields = (await decryptJson<EmergencyContactEncryptedFields>(row.encrypted_data)) ?? {
    name: '',
    relationship: null,
    phone_country_code: null,
    phone: null,
    is_primary: 0,
  };

  return {
    local_uuid: row.local_uuid,
    user_id: row.user_id,
    server_id: row.server_id,
    sync_status: row.sync_status,
    deleted_locally: row.deleted_locally,
    updated_at_local: row.updated_at_local,
    ...fields,
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
  const encryptedData = await encryptJson<EmergencyContactEncryptedFields>({
    name: payload.name,
    relationship: payload.relationship ?? null,
    phone_country_code: payload.phone_country_code ?? null,
    phone: payload.phone ?? null,
    is_primary: payload.is_primary ? 1 : 0,
  });

  await db.runAsync(
    `INSERT INTO emergency_contacts (local_uuid, user_id, server_id, encrypted_data, sync_status, deleted_locally, updated_at_local)
     VALUES (?, ?, NULL, ?, 'synced', 0, ?)`,
    localUuid,
    userId,
    encryptedData,
    now,
  );
  return localUuid;
}

export async function updateLocal(localUuid: string, payload: Partial<EmergencyContactPayload>): Promise<void> {
  const db = await getDb();
  const existing = await getByLocalUuid(localUuid);
  if (!existing) return;

  const encryptedData = await encryptJson<EmergencyContactEncryptedFields>({
    name: payload.name ?? existing.name,
    relationship: payload.relationship ?? existing.relationship,
    phone_country_code: payload.phone_country_code ?? existing.phone_country_code,
    phone: payload.phone ?? existing.phone,
    is_primary: payload.is_primary !== undefined ? (payload.is_primary ? 1 : 0) : existing.is_primary,
  });

  await db.runAsync(
    `UPDATE emergency_contacts SET encrypted_data = ?, sync_status = 'synced', updated_at_local = ? WHERE local_uuid = ?`,
    encryptedData,
    new Date().toISOString(),
    localUuid,
  );
}

export async function markSyncedCreate(localUuid: string, serverId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE emergency_contacts SET server_id = ?, sync_status = 'synced', updated_at_local = ? WHERE local_uuid = ?`,
    serverId,
    new Date().toISOString(),
    localUuid,
  );
}

export async function markSynced(localUuid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE emergency_contacts SET sync_status = 'synced', updated_at_local = ? WHERE local_uuid = ?`,
    new Date().toISOString(),
    localUuid,
  );
}

export async function markConflict(localUuid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE emergency_contacts SET sync_status = 'conflict' WHERE local_uuid = ?`, localUuid);
}

export async function deleteLocal(localUuid: string): Promise<{ requiresNetworkDelete: boolean }> {
  const db = await getDb();
  const existing = await getByLocalUuid(localUuid);
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

export async function discardConflict(localUuid: string): Promise<void> {
  const db = await getDb();
  const existing = await getByLocalUuid(localUuid);
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

export function toPayload(row: EmergencyContactRow): EmergencyContactPayload {
  return {
    name: row.name,
    relationship: row.relationship ?? undefined,
    phone_country_code: row.phone_country_code ?? undefined,
    phone: row.phone ?? undefined,
    is_primary: !!row.is_primary,
  };
}
