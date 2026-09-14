import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 24;

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS emergency_field_history (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      field_key TEXT NOT NULL,
      encrypted_value TEXT NOT NULL,
      changed_at_local TEXT NOT NULL,
      server_recorded_at TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending'
    );
    CREATE INDEX IF NOT EXISTS idx_emergency_field_history_user_time
      ON emergency_field_history (user_id, changed_at_local DESC);
    CREATE INDEX IF NOT EXISTS idx_emergency_field_history_pending
      ON emergency_field_history (user_id, sync_status);
  `);
}
