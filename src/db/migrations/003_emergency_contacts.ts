import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 3;

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS emergency_contacts (
      local_uuid TEXT PRIMARY KEY,
      server_id INTEGER,
      encrypted_data TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      deleted_locally INTEGER NOT NULL DEFAULT 0,
      updated_at_local TEXT NOT NULL
    );
  `);
}
