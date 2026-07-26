import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 5;

/**
 * Singleton local cache of this device's registered sealed-box public key (mirrors medical_information's
 * id=1 pattern). The matching private key never lives here — it's SecureStore-only, see
 * device-key-storage.ts. `pending_revoke_server_id` marks an old key as awaiting DELETE confirmation
 * during rotation, so an interrupted rotation can retry the revoke on next app foreground.
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS device_keys (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      server_device_key_id INTEGER,
      public_key TEXT NOT NULL,
      label TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      registered_at TEXT,
      pending_revoke_server_id INTEGER,
      updated_at_local TEXT NOT NULL
    );
  `);
}
