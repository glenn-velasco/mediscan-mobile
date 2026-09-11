import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 18;

/**
 * My scan activity — stores who scanned the current user's QR code locally.
 * Each row represents a single scan event by a verified professional.
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS my_scan_activity (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      scanner_fullname TEXT NOT NULL,
      scanned_at TEXT NOT NULL,
      synced_at TEXT NOT NULL
    );
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_my_scan_activity_user
    ON my_scan_activity (user_id, scanned_at DESC);
  `);
}
