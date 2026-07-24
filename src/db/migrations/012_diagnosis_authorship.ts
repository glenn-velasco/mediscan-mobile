import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 12;

/**
 * Diagnoses are now authored by a verified professional rather than the patient (see the
 * backend repo's docs/DIAGNOSES.md) - `diagnosed_by_id`/`diagnosed_by_name` record who, mirrored
 * locally so the "Diagnosed by Dr. X" label can render offline. Not PHI (just the authoring
 * professional's own identity), so unlike `condition` these aren't stored via `encryptField`.
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE diagnoses ADD COLUMN diagnosed_by_id INTEGER;
    ALTER TABLE diagnoses ADD COLUMN diagnosed_by_name TEXT;
  `);
}
