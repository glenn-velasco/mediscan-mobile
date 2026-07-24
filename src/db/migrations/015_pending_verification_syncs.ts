import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 15;

/**
 * Local queue for verification sync operations.
 * Stores verification toggles that need to be synced to the server when online.
 * Works offline-first: writes locally, syncs when connection is available.
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS pending_verification_syncs (
      local_id TEXT PRIMARY KEY,
      patient_id INTEGER NOT NULL,
      envelope_type TEXT NOT NULL,
      item_identifier TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 1,
      synced INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX idx_pvs_patient_synced ON pending_verification_syncs(patient_id, synced);
    CREATE INDEX idx_pvs_unsynced ON pending_verification_syncs(synced) WHERE synced = 0;
  `);
}
