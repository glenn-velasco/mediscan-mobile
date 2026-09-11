import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 17;

/**
 * Scanned patients — stores the professional's scan history locally for offline access.
 * Each row represents a unique patient the professional has scanned, with cached
 * profile info and any notes the professional added.
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS scanned_patients (
      patient_server_id INTEGER NOT NULL,
      professional_id INTEGER NOT NULL,
      fullname TEXT NOT NULL,
      avatar_url TEXT,
      age INTEGER,
      gender TEXT,
      dob TEXT,
      notes TEXT,
      scan_count INTEGER NOT NULL DEFAULT 1,
      last_scanned_at TEXT NOT NULL,
      synced_at TEXT NOT NULL,
      PRIMARY KEY (patient_server_id, professional_id)
    );
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_scanned_patients_professional
    ON scanned_patients (professional_id);
  `);
}
