import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 1;

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS medical_information (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      server_id INTEGER,
      full_name TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      first_name TEXT NOT NULL DEFAULT '',
      middle_name TEXT,
      last_name TEXT NOT NULL DEFAULT '',
      suffix TEXT,
      date_of_birth TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT '',
      phone_country_code TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      blood_type TEXT NOT NULL DEFAULT '',
      religion TEXT,
      address TEXT NOT NULL DEFAULT '',
      no_blood_transfusion INTEGER NOT NULL DEFAULT 0,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      updated_at_local TEXT NOT NULL,
      server_updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS allergies (
      local_uuid TEXT PRIMARY KEY,
      server_id INTEGER,
      allergen TEXT NOT NULL,
      reaction TEXT,
      severity TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      deleted_locally INTEGER NOT NULL DEFAULT 0,
      updated_at_local TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mutation_queue (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_local_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}
