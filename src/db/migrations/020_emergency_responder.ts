import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 20;

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS recent_emergency_scans (
      id TEXT PRIMARY KEY NOT NULL,
      payload_hash TEXT UNIQUE NOT NULL,
      encrypted_snapshot TEXT NOT NULL,
      scanned_at TEXT NOT NULL,
      last_viewed_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      scan_count INTEGER NOT NULL DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_recent_emergency_scans_expiry
      ON recent_emergency_scans (expires_at);

    CREATE TABLE IF NOT EXISTS emergency_profile_settings (
      user_id TEXT PRIMARY KEY NOT NULL,
      encrypted_settings TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scan_metric_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      scanner_opened_at TEXT NOT NULL,
      code_detected_at TEXT,
      summary_visible_at TEXT,
      interactions INTEGER NOT NULL DEFAULT 0,
      outcome TEXT NOT NULL,
      failure_reason TEXT,
      critical_fields_found INTEGER NOT NULL DEFAULT 0,
      internet_available INTEGER NOT NULL
    );
  `);
}
