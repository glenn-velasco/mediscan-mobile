import { getDb } from '@/db/client';
import { getCurrentUserId } from '@/db/context';
import type { DeviceKeyRow } from '@/db/schema';

export async function getLocal(userId?: string | number): Promise<DeviceKeyRow | null> {
  const db = await getDb();
  let uid: string | number;
  try {
    uid = userId ?? getCurrentUserId();
  } catch {
    return null;
  }
  const row = await db.getFirstAsync<DeviceKeyRow>('SELECT * FROM device_keys WHERE user_id = ?', uid);
  return row ?? null;
}

/** Saves a locally-generated keypair without server registration (for offline-first bootstrap). */
export async function saveLocal(params: { publicKey: string; label: string }): Promise<void> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO device_keys (user_id, server_device_key_id, public_key, label, is_active, registered_at, pending_revoke_server_id, updated_at_local)
     VALUES (?, NULL, ?, ?, 1, NULL, NULL, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       public_key = excluded.public_key,
       label = excluded.label,
       is_active = 1,
       updated_at_local = excluded.updated_at_local`,
    userId,
    params.publicKey,
    params.label,
    now,
  );
}

/** Writes a newly-registered device key, replacing whatever was there before (rotation calls this too). */
export async function saveRegistered(params: {
  serverDeviceKeyId: string | number;
  publicKey: string;
  label: string | null;
  registeredAt: string;
}): Promise<void> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO device_keys (user_id, server_device_key_id, public_key, label, is_active, registered_at, pending_revoke_server_id, updated_at_local)
     VALUES (?, ?, ?, ?, 1, ?, NULL, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       server_device_key_id = excluded.server_device_key_id,
       public_key = excluded.public_key,
       label = excluded.label,
       is_active = 1,
       registered_at = excluded.registered_at,
       updated_at_local = excluded.updated_at_local`,
    userId,
    params.serverDeviceKeyId,
    params.publicKey,
    params.label,
    params.registeredAt,
    now,
  );
}

/** Marks the previous server key id as awaiting a DELETE confirmation during rotation. */
export async function markPendingRevoke(oldServerDeviceKeyId: string | number): Promise<void> {
  const db = await getDb();
  const userId = getCurrentUserId();
  await db.runAsync(
    `UPDATE device_keys SET pending_revoke_server_id = ?, updated_at_local = ? WHERE user_id = ?`,
    oldServerDeviceKeyId,
    new Date().toISOString(),
    userId,
  );
}

export async function clearPendingRevoke(): Promise<void> {
  const db = await getDb();
  let userId: string | number;
  try {
    userId = getCurrentUserId();
  } catch {
    return;
  }
  await db.runAsync(
    `UPDATE device_keys SET pending_revoke_server_id = NULL, updated_at_local = ? WHERE user_id = ?`,
    new Date().toISOString(),
    userId,
  );
}

export async function clear(userId?: string | number): Promise<void> {
  const db = await getDb();
  let uid: string | number;
  try {
    uid = userId ?? getCurrentUserId();
  } catch {
    return;
  }
  await db.runAsync('DELETE FROM device_keys WHERE user_id = ?', uid);
}
