import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 21;

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS dynamic_emergency_cards (
      user_id TEXT PRIMARY KEY NOT NULL,
      encrypted_token TEXT NOT NULL,
      issued_at TEXT NOT NULL,
      pending_publish INTEGER NOT NULL DEFAULT 1,
      last_published_at TEXT,
      last_error_at TEXT
    );
  `);
}
