import * as Crypto from 'expo-crypto';

import { getDb } from '@/db/client';
import { getCurrentUserId } from '@/db/context';
import { encryptField, decryptField } from '@/lib/crypto';
import type { AllergyRawRow, AllergyRow } from '@/db/schema';
import type { AllergyPayload } from '@/api/types';

async function decryptRow(row: AllergyRawRow): Promise<AllergyRow> {
  return {
    local_uuid: row.local_uuid,
    user_id: row.user_id,
    server_id: row.server_id,
    sync_status: row.sync_status,
    deleted_locally: row.deleted_locally,
    updated_at_local: row.updated_at_local,
    allergen: (await decryptField(row.allergen)) ?? '',
    reaction: await decryptField(row.reaction),
    severity: row.severity,
  };
}

export async function getAll(): Promise<AllergyRow[]> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const rows = await db.getAllAsync<AllergyRawRow>(
    'SELECT * FROM allergies WHERE user_id = ? AND deleted_locally = 0 ORDER BY updated_at_local DESC',
    userId,
  );
  return Promise.all(rows.map(decryptRow));
}

/** Like `getAll()` but includes rows pending a delete-push - the cloud sync push loop needs to see those too, unlike normal UI listings. */
export async function getAllForPush(): Promise<AllergyRow[]> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const rows = await db.getAllAsync<AllergyRawRow>(
    'SELECT * FROM allergies WHERE user_id = ? ORDER BY updated_at_local DESC',
    userId,
  );
  return Promise.all(rows.map(decryptRow));
}

export async function getByLocalUuid(localUuid: string): Promise<AllergyRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<AllergyRawRow>(
    'SELECT * FROM allergies WHERE local_uuid = ?',
    localUuid,
  );
  return row ? decryptRow(row) : null;
}

export async function createLocal(payload: AllergyPayload): Promise<string> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const localUuid = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO allergies (local_uuid, user_id, server_id, allergen, reaction, severity, sync_status, deleted_locally, updated_at_local)
     VALUES (?, ?, NULL, ?, ?, ?, 'synced', 0, ?)`,
    localUuid,
    userId,
    await encryptField(payload.allergen),
    await encryptField(payload.reaction ?? null),
    payload.severity,
    now,
  );
  return localUuid;
}

export async function updateLocal(localUuid: string, payload: Partial<AllergyPayload>): Promise<void> {
  const db = await getDb();
  const existing = await getByLocalUuid(localUuid);
  if (!existing) return;

  await db.runAsync(
    `UPDATE allergies SET allergen = ?, reaction = ?, severity = ?, sync_status = 'synced', updated_at_local = ? WHERE local_uuid = ?`,
    await encryptField(payload.allergen ?? existing.allergen),
    await encryptField(payload.reaction ?? existing.reaction),
    payload.severity ?? existing.severity,
    new Date().toISOString(),
    localUuid,
  );
}

export async function markSyncedCreate(localUuid: string, serverId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE allergies SET server_id = ?, sync_status = 'synced', updated_at_local = ? WHERE local_uuid = ?`,
    serverId,
    new Date().toISOString(),
    localUuid,
  );
}

export async function markSynced(localUuid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE allergies SET sync_status = 'synced', updated_at_local = ? WHERE local_uuid = ?`,
    new Date().toISOString(),
    localUuid,
  );
}

export async function markConflict(localUuid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE allergies SET sync_status = 'conflict' WHERE local_uuid = ?`, localUuid);
}

/** Soft-deletes a synced allergy (hidden from lists) pending confirmation from the server; hard-deletes an unsynced one immediately since nothing was ever sent. */
export async function deleteLocal(localUuid: string): Promise<{ requiresNetworkDelete: boolean }> {
  const db = await getDb();
  const existing = await getByLocalUuid(localUuid);
  if (!existing) return { requiresNetworkDelete: false };

  if (!existing.server_id) {
    await db.runAsync('DELETE FROM allergies WHERE local_uuid = ?', localUuid);
    return { requiresNetworkDelete: false };
  }

  await db.runAsync(
    `UPDATE allergies SET sync_status = 'pending', deleted_locally = 1, updated_at_local = ? WHERE local_uuid = ?`,
    new Date().toISOString(),
    localUuid,
  );
  return { requiresNetworkDelete: true };
}

export async function hardDelete(localUuid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM allergies WHERE local_uuid = ?', localUuid);
}

/** Discards a conflicted local change: hard-deletes an unsynced optimistic create, or reverts a synced record back to 'synced' so the next server reconciliation overwrites it with authoritative data. */
export async function discardConflict(localUuid: string): Promise<void> {
  const db = await getDb();
  const existing = await getByLocalUuid(localUuid);
  if (!existing) return;

  if (!existing.server_id) {
    await db.runAsync('DELETE FROM allergies WHERE local_uuid = ?', localUuid);
    return;
  }

  await db.runAsync(
    `UPDATE allergies SET sync_status = 'synced', deleted_locally = 0, updated_at_local = ? WHERE local_uuid = ?`,
    new Date().toISOString(),
    localUuid,
  );
}

/**
 * Writes a record pulled from `GET /sync`. The server's `id` IS this row's `local_uuid` (see the
 * client-generated-UUID design in the backend repo's docs/SYNC.md), so this is a plain upsert-by-key
 * - never a create-then-reconcile step. Last-write-wins: whatever the server returned overwrites the
 * local row unconditionally, since the server is only ever asked for rows changed since the last pull.
 */
export async function upsertFromServer(record: {
  id: string;
  allergen: string;
  reaction?: string;
  severity: AllergyRow['severity'];
  updated_at: string;
}): Promise<void> {
  const db = await getDb();
  const userId = getCurrentUserId();

  await db.runAsync(
    `INSERT INTO allergies (local_uuid, user_id, server_id, allergen, reaction, severity, sync_status, deleted_locally, updated_at_local)
     VALUES (?, ?, 1, ?, ?, ?, 'synced', 0, ?)
     ON CONFLICT(local_uuid) DO UPDATE SET
       server_id = 1,
       allergen = excluded.allergen,
       reaction = excluded.reaction,
       severity = excluded.severity,
       sync_status = 'synced',
       deleted_locally = 0,
       updated_at_local = excluded.updated_at_local`,
    record.id,
    userId,
    await encryptField(record.allergen),
    await encryptField(record.reaction ?? null),
    record.severity,
    record.updated_at,
  );
}

export function toPayload(row: AllergyRow): AllergyPayload {
  return {
    allergen: row.allergen,
    reaction: row.reaction ?? undefined,
    severity: row.severity,
  };
}
