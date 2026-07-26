import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 6;

/**
 * Transport-agnostic inbox for professional-submitted envelopes, whether they arrived via the relay
 * (`server_envelope_id` set) or over BLE (`server_envelope_id` NULL, `transport = 'ble'`). Decrypt and
 * merge logic is identical either way, so both flow through the same table and the same
 * merge.service.processEnvelope pipeline.
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_sync_envelopes (
      local_id TEXT PRIMARY KEY,
      server_envelope_id INTEGER,
      transport TEXT NOT NULL DEFAULT 'relay',
      sender_id INTEGER,
      envelope_type TEXT NOT NULL,
      ciphertext TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'received',
      decrypt_error TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      processed_at TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_pending_sync_envelopes_server_id
      ON pending_sync_envelopes (server_envelope_id)
      WHERE server_envelope_id IS NOT NULL;
  `);
}
