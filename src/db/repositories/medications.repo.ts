import * as Crypto from 'expo-crypto';

import { getDb } from '@/db/client';
import { getCurrentUserId } from '@/db/context';
import { encryptJson, decryptJson } from '@/lib/crypto';
import type { MedicationEncryptedFields, MedicationRawRow, MedicationRow } from '@/db/schema';
import type { MedicationPayload } from '@/api/types';

async function decryptRow(row: MedicationRawRow): Promise<MedicationRow> {
  const fields = (await decryptJson<MedicationEncryptedFields>(row.encrypted_data)) ?? {
    name: '',
    dosage: '',
    frequency: '',
    notes: null,
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

export async function getAll(): Promise<MedicationRow[]> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const rows = await db.getAllAsync<MedicationRawRow>(
    'SELECT * FROM medications WHERE user_id = ? AND deleted_locally = 0 ORDER BY updated_at_local DESC',
    userId,
  );
  return Promise.all(rows.map(decryptRow));
}

export async function getByLocalUuid(localUuid: string): Promise<MedicationRow | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<MedicationRawRow>(
    'SELECT * FROM medications WHERE local_uuid = ?',
    localUuid,
  );
  return row ? decryptRow(row) : null;
}

export async function createLocal(payload: MedicationPayload): Promise<string> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const localUuid = Crypto.randomUUID();
  const now = new Date().toISOString();
  const encryptedData = await encryptJson<MedicationEncryptedFields>({
    name: payload.name,
    dosage: payload.dosage,
    frequency: payload.frequency,
    notes: payload.notes ?? null,
  });

  await db.runAsync(
    `INSERT INTO medications (local_uuid, user_id, server_id, encrypted_data, sync_status, deleted_locally, updated_at_local)
     VALUES (?, ?, NULL, ?, 'synced', 0, ?)`,
    localUuid,
    userId,
    encryptedData,
    now,
  );
  return localUuid;
}

export async function updateLocal(localUuid: string, payload: Partial<MedicationPayload>): Promise<void> {
  const db = await getDb();
  const existing = await getByLocalUuid(localUuid);
  if (!existing) return;

  const encryptedData = await encryptJson<MedicationEncryptedFields>({
    name: payload.name ?? existing.name,
    dosage: payload.dosage ?? existing.dosage,
    frequency: payload.frequency ?? existing.frequency,
    notes: payload.notes !== undefined ? payload.notes ?? null : existing.notes,
  });

  await db.runAsync(
    `UPDATE medications SET encrypted_data = ?, sync_status = 'synced', updated_at_local = ? WHERE local_uuid = ?`,
    encryptedData,
    new Date().toISOString(),
    localUuid,
  );
}

export async function markSyncedCreate(localUuid: string, serverId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE medications SET server_id = ?, sync_status = 'synced', updated_at_local = ? WHERE local_uuid = ?`,
    serverId,
    new Date().toISOString(),
    localUuid,
  );
}

export async function markSynced(localUuid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE medications SET sync_status = 'synced', updated_at_local = ? WHERE local_uuid = ?`,
    new Date().toISOString(),
    localUuid,
  );
}

export async function markConflict(localUuid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`UPDATE medications SET sync_status = 'conflict' WHERE local_uuid = ?`, localUuid);
}

/** Soft-deletes a synced medication (hidden from lists) pending confirmation from the server; hard-deletes an unsynced one immediately since nothing was ever sent. */
export async function deleteLocal(localUuid: string): Promise<{ requiresNetworkDelete: boolean }> {
  const db = await getDb();
  const existing = await getByLocalUuid(localUuid);
  if (!existing) return { requiresNetworkDelete: false };

  if (!existing.server_id) {
    await db.runAsync('DELETE FROM medications WHERE local_uuid = ?', localUuid);
    return { requiresNetworkDelete: false };
  }

  await db.runAsync(
    `UPDATE medications SET sync_status = 'pending', deleted_locally = 1, updated_at_local = ? WHERE local_uuid = ?`,
    new Date().toISOString(),
    localUuid,
  );
  return { requiresNetworkDelete: true };
}

export async function hardDelete(localUuid: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM medications WHERE local_uuid = ?', localUuid);
}

/** Discards a conflicted local change: hard-deletes an unsynced optimistic create, or reverts a synced record back to 'synced' so the next server reconciliation overwrites it with authoritative data. */
export async function discardConflict(localUuid: string): Promise<void> {
  const db = await getDb();
  const existing = await getByLocalUuid(localUuid);
  if (!existing) return;

  if (!existing.server_id) {
    await db.runAsync('DELETE FROM medications WHERE local_uuid = ?', localUuid);
    return;
  }

  await db.runAsync(
    `UPDATE medications SET sync_status = 'synced', deleted_locally = 0, updated_at_local = ? WHERE local_uuid = ?`,
    new Date().toISOString(),
    localUuid,
  );
}

export function toPayload(row: MedicationRow): MedicationPayload {
  return {
    name: row.name,
    dosage: row.dosage,
    frequency: row.frequency,
    notes: row.notes ?? undefined,
  };
}
