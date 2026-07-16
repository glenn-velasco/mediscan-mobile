import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 2;

/**
 * Moves all PHI (name, DOB, blood type, address, allergen, reaction, severity, etc.) out of plain
 * SQLite columns into a single AES-encrypted `encrypted_data` blob per row. Dropping and recreating
 * is safe here rather than migrating row-by-row: local data is always reconciled fresh from
 * `GET /me` on next login/foreground (see `saveFromServer` in the medical-information/allergies
 * repos), so nothing is permanently lost — only an unsynced local edit made offline right before
 * this migration runs would need to be re-entered.
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    DROP TABLE IF EXISTS medical_information;
    DROP TABLE IF EXISTS allergies;

    CREATE TABLE medical_information (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      server_id INTEGER,
      email TEXT NOT NULL DEFAULT '',
      encrypted_data TEXT NOT NULL DEFAULT '',
      sync_status TEXT NOT NULL DEFAULT 'synced',
      updated_at_local TEXT NOT NULL,
      server_updated_at TEXT
    );

    CREATE TABLE allergies (
      local_uuid TEXT PRIMARY KEY,
      server_id INTEGER,
      encrypted_data TEXT NOT NULL DEFAULT '',
      sync_status TEXT NOT NULL DEFAULT 'pending',
      deleted_locally INTEGER NOT NULL DEFAULT 0,
      updated_at_local TEXT NOT NULL
    );
  `);
}
