import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDb } from '@/db/client';
import { getCurrentUserId } from '@/db/context';
import { decryptJson, encryptJson } from '@/lib/crypto';

export const EMERGENCY_HISTORY_FIELDS = ['date_of_birth', 'blood_type', 'no_blood_transfusion'] as const;
export type EmergencyHistoryField = typeof EMERGENCY_HISTORY_FIELDS[number];

export type EmergencyFieldChange = {
  id: string;
  field: EmergencyHistoryField;
  value: string | null;
  changedAt: string;
  serverRecordedAt: string | null;
  syncStatus: 'pending' | 'synced';
};

type StoredChange = {
  id: string;
  user_id: string;
  field_key: EmergencyHistoryField;
  encrypted_value: string;
  changed_at_local: string;
  server_recorded_at: string | null;
  sync_status: 'pending' | 'synced';
};

export type PreparedChange = Pick<StoredChange, 'id' | 'user_id' | 'field_key' | 'encrypted_value' | 'changed_at_local'>;

export async function prepareChanges(
  userId: string | number,
  changes: Partial<Record<EmergencyHistoryField, string | null>>,
  changedAt: string,
): Promise<PreparedChange[]> {
  return Promise.all(Object.entries(changes).map(async ([field, value]) => ({
    id: Crypto.randomUUID(),
    user_id: String(userId),
    field_key: field as EmergencyHistoryField,
    encrypted_value: await encryptJson(value ?? null),
    changed_at_local: changedAt,
  })));
}

export async function insertPrepared(db: SQLiteDatabase, changes: PreparedChange[]): Promise<void> {
  for (const change of changes) {
    await db.runAsync(
      `INSERT INTO emergency_field_history (id, user_id, field_key, encrypted_value, changed_at_local, sync_status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      change.id, change.user_id, change.field_key, change.encrypted_value, change.changed_at_local,
    );
  }
}

async function decode(row: StoredChange): Promise<EmergencyFieldChange | null> {
  try {
    const value = await decryptJson<string | null>(row.encrypted_value);
    return {
      id: row.id,
      field: row.field_key,
      value,
      changedAt: row.changed_at_local,
      serverRecordedAt: row.server_recorded_at,
      syncStatus: row.sync_status,
    };
  } catch {
    return null;
  }
}

export async function getRecent(limit = 5, userId: string | number = getCurrentUserId()): Promise<EmergencyFieldChange[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<StoredChange>(
    'SELECT * FROM emergency_field_history WHERE user_id = ? ORDER BY changed_at_local DESC, id DESC LIMIT ?',
    String(userId), limit,
  );
  return (await Promise.all(rows.map(decode))).filter((row): row is EmergencyFieldChange => row !== null);
}

export async function getPending(limit = 50): Promise<EmergencyFieldChange[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<StoredChange>(
    `SELECT * FROM emergency_field_history WHERE user_id = ? AND sync_status = 'pending'
     ORDER BY changed_at_local, id LIMIT ?`,
    String(getCurrentUserId()), limit,
  );
  return (await Promise.all(rows.map(decode))).filter((row): row is EmergencyFieldChange => row !== null);
}

export async function markSynced(recorded: { id: string; server_recorded_at: string }[]): Promise<void> {
  if (!recorded.length) return;
  const db = await getDb();
  for (const item of recorded) {
    await db.runAsync(
      `UPDATE emergency_field_history SET sync_status = 'synced', server_recorded_at = ?
       WHERE id = ? AND user_id = ?`,
      item.server_recorded_at, item.id, String(getCurrentUserId()),
    );
  }
}

export async function cacheServerChanges(changes: EmergencyFieldChange[]): Promise<number> {
  const db = await getDb();
  const userId = String(getCurrentUserId());
  let inserted = 0;
  for (const change of changes) {
    if (!EMERGENCY_HISTORY_FIELDS.includes(change.field)) continue;
    const encrypted = await encryptJson(change.value);
    const result = await db.runAsync(
      `INSERT OR IGNORE INTO emergency_field_history
       (id, user_id, field_key, encrypted_value, changed_at_local, server_recorded_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, 'synced')`,
      change.id, userId, change.field, encrypted, change.changedAt, change.serverRecordedAt,
    );
    inserted += result.changes;
  }
  return inserted;
}
