import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 13;

/**
 * Conditions - a peer data category to allergies/diagnoses/medications (single free-text
 * `description` field, deliberately no fixed list/enum - a patient's own account of their
 * general health shouldn't be constrained to predefined terms; see the backend repo's
 * docs/DIAGNOSES.md), patient-authored with the same sync lifecycle as allergies.
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS conditions (
      local_uuid TEXT PRIMARY KEY,
      server_id INTEGER,
      user_id INTEGER NOT NULL DEFAULT 0,
      description TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      deleted_locally INTEGER NOT NULL DEFAULT 0,
      updated_at_local TEXT NOT NULL
    );
  `);
}
