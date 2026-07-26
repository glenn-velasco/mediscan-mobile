import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 9;

export async function up(db: SQLiteDatabase): Promise<void> {
  // runMigrations already wraps up() in a transaction, so no withTransactionAsync here.
  await db.execAsync(`PRAGMA foreign_keys = OFF`);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS medical_information_new (
      user_id INTEGER NOT NULL,
      server_id INTEGER,
      email TEXT NOT NULL DEFAULT '',
      encrypted_data TEXT NOT NULL DEFAULT '',
      sync_status TEXT NOT NULL DEFAULT 'synced',
      updated_at_local TEXT NOT NULL,
      server_updated_at TEXT,
      PRIMARY KEY (user_id)
    );
  `);

  // Guard: only migrate if the old singleton table actually has rows
  const hasOldMi = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM medical_information',
  );
  if (hasOldMi && hasOldMi.cnt > 0) {
    await db.runAsync(
      `INSERT INTO medical_information_new (user_id, server_id, email, encrypted_data, sync_status, updated_at_local, server_updated_at)
       SELECT 0, server_id, email, encrypted_data, sync_status, updated_at_local, server_updated_at FROM medical_information`,
    );
  }

  await db.execAsync(`DROP TABLE IF EXISTS medical_information`);
  await db.execAsync(`ALTER TABLE medical_information_new RENAME TO medical_information`);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS device_keys_new (
      user_id INTEGER NOT NULL,
      server_device_key_id INTEGER,
      public_key TEXT NOT NULL,
      label TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      registered_at TEXT,
      pending_revoke_server_id INTEGER,
      updated_at_local TEXT NOT NULL,
      PRIMARY KEY (user_id)
    );
  `);

  const hasOldDk = await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM device_keys',
  );
  if (hasOldDk && hasOldDk.cnt > 0) {
    await db.runAsync(
      `INSERT INTO device_keys_new (user_id, server_device_key_id, public_key, label, is_active, registered_at, pending_revoke_server_id, updated_at_local)
       SELECT 0, server_device_key_id, public_key, label, is_active, registered_at, pending_revoke_server_id, updated_at_local FROM device_keys`,
    );
  }

  await db.execAsync(`DROP TABLE IF EXISTS device_keys`);
  await db.execAsync(`ALTER TABLE device_keys_new RENAME TO device_keys`);

  // Guard ALTER TABLE with IF NOT EXISTS-style column check via try/catch
  for (const table of ['allergies', 'diagnoses', 'emergency_contacts', 'pending_sync_envelopes', 'professional_attestations']) {
    try {
      await db.execAsync(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER DEFAULT 0`);
    } catch {
      // Column already exists — fine on re-runs
    }
  }

  await db.execAsync(`PRAGMA foreign_keys = ON`);
}
