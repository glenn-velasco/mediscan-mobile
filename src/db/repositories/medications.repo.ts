import * as Crypto from 'expo-crypto';

import { getDb } from '@/db/client';
import { getCurrentUserId } from '@/db/context';
import { encryptField, decryptField } from '@/lib/crypto';
import * as professionalAttestationRepo from '@/db/repositories/professional-attestation.repo';
import type { MedicationRawRow, MedicationRow, VerifiedByEntry } from '@/db/schema';
import type { MedicationPayload } from '@/api/types';

function parseVerifiedBy(value: unknown): VerifiedByEntry[] | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function decryptRow(row: MedicationRawRow): Promise<MedicationRow> {
  return {
    local_uuid: row.local_uuid,
    user_id: row.user_id,
    server_id: row.server_id,
    sync_status: row.sync_status,
    deleted_locally: row.deleted_locally,
    updated_at_local: row.updated_at_local,
    name: (await decryptField(row.name)) ?? '',
    dosage: (await decryptField(row.dosage)) ?? '',
    frequency: row.frequency,
    notes: await decryptField(row.notes),
    verified_by: parseVerifiedBy(row.verified_by),
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

/** Like `getAll()` but includes rows pending a delete-push - the cloud sync push loop needs to see those too, unlike normal UI listings. */
export async function getAllForPush(): Promise<MedicationRow[]> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const rows = await db.getAllAsync<MedicationRawRow>(
    'SELECT * FROM medications WHERE user_id = ? ORDER BY updated_at_local DESC',
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

  await db.runAsync(
    `INSERT INTO medications (local_uuid, user_id, server_id, name, dosage, frequency, notes, sync_status, deleted_locally, updated_at_local)
     VALUES (?, ?, NULL, ?, ?, ?, ?, 'synced', 0, ?)`,
    localUuid,
    userId,
    await encryptField(payload.name),
    await encryptField(payload.dosage),
    payload.frequency,
    await encryptField(payload.notes ?? null),
    now,
  );
  return localUuid;
}

export async function updateLocal(localUuid: string, payload: Partial<MedicationPayload>): Promise<void> {
  const [db, existing] = await Promise.all([getDb(), getByLocalUuid(localUuid)]);
  if (!existing) return;

  const dataChanged =
    (payload.name != null && payload.name !== existing.name) ||
    (payload.dosage != null && payload.dosage !== existing.dosage) ||
    (payload.frequency != null && payload.frequency !== existing.frequency) ||
    (payload.notes !== undefined && (payload.notes ?? '') !== (existing.notes ?? ''));

  if (dataChanged) {
    await professionalAttestationRepo.removeForMedication(localUuid);
  }

  await db.runAsync(
    `UPDATE medications SET name = ?, dosage = ?, frequency = ?, notes = ?, verified_by = ?, sync_status = ?, updated_at_local = ? WHERE local_uuid = ?`,
    await encryptField(payload.name ?? existing.name),
    await encryptField(payload.dosage ?? existing.dosage),
    payload.frequency ?? existing.frequency,
    await encryptField(payload.notes !== undefined ? (payload.notes ?? null) : existing.notes),
    dataChanged ? null : JSON.stringify(existing.verified_by ?? []),
    dataChanged ? 'pending' : 'synced',
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
  const [db, existing] = await Promise.all([getDb(), getByLocalUuid(localUuid)]);
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
  const [db, existing] = await Promise.all([getDb(), getByLocalUuid(localUuid)]);
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

/** See `allergies.repo.ts`'s `upsertFromServer` for the design rationale - identical shape. */
export async function upsertFromServer(record: {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  notes?: string;
  verified_by?: string | null;
  updated_at: string;
}): Promise<void> {
  const db = await getDb();
  const userId = getCurrentUserId();

  await db.runAsync(
    `INSERT INTO medications (local_uuid, user_id, server_id, name, dosage, frequency, notes, verified_by, sync_status, deleted_locally, updated_at_local)
     VALUES (?, ?, 1, ?, ?, ?, ?, ?, 'synced', 0, ?)
     ON CONFLICT(local_uuid) DO UPDATE SET
       server_id = 1,
       name = excluded.name,
       dosage = excluded.dosage,
       frequency = excluded.frequency,
       notes = excluded.notes,
       verified_by = excluded.verified_by,
       sync_status = 'synced',
       deleted_locally = 0,
       updated_at_local = excluded.updated_at_local`,
    record.id,
    userId,
    await encryptField(record.name),
    await encryptField(record.dosage),
    record.frequency,
    await encryptField(record.notes ?? null),
    record.verified_by != null
      ? (typeof record.verified_by === 'string' ? record.verified_by : JSON.stringify(record.verified_by))
      : null,
    record.updated_at,
  );
}

export function toPayload(row: MedicationRow): MedicationPayload & { verified_by?: string | null } {
  return {
    name: row.name,
    dosage: row.dosage,
    frequency: row.frequency,
    notes: row.notes ?? undefined,
    verified_by: row.verified_by != null ? JSON.stringify(row.verified_by) : null,
  };
}

/**
 * Update the verified_by JSON column on a medication record.
 * Adds or updates the verification entry for the given professional (idempotent).
 */
export async function updateVerifiedBy(localUuid: string, entry: VerifiedByEntry): Promise<void> {
  const [db, existing] = await Promise.all([getDb(), getByLocalUuid(localUuid)]);
  if (!existing) return;

  const current: VerifiedByEntry[] = existing.verified_by ?? [];
  // Remove existing entry for this user (idempotent)
  const filtered = current.filter(v => v.user_id !== entry.user_id);
  filtered.push(entry);

  await db.runAsync(
    'UPDATE medications SET verified_by = ?, updated_at_local = ? WHERE local_uuid = ?',
    JSON.stringify(filtered),
    new Date().toISOString(),
    localUuid,
  );
  console.debug('[MedicationRepo] Updated verified_by', { localUuid, userId: entry.user_id });
}

/**
 * Remove a verification entry for a specific user from a medication record.
 */
export async function removeVerifiedBy(localUuid: string, userId: number): Promise<void> {
  const [db, existing] = await Promise.all([getDb(), getByLocalUuid(localUuid)]);
  if (!existing || !existing.verified_by) return;

  const filtered = existing.verified_by.filter(v => v.user_id !== userId);

  await db.runAsync(
    'UPDATE medications SET verified_by = ?, updated_at_local = ? WHERE local_uuid = ?',
    filtered.length > 0 ? JSON.stringify(filtered) : null,
    new Date().toISOString(),
    localUuid,
  );
  console.debug('[MedicationRepo] Removed verified_by', { localUuid, userId });
}
