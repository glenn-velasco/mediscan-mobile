import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 19;

/**
 * Supabase uses UUIDs for auth users and application records. SQLite's special
 * `INTEGER PRIMARY KEY` columns only accept integer values, so tables that used
 * those columns as their primary key must be rebuilt with TEXT keys.
 *
 * Existing numeric Laravel-era identifiers are preserved by casting them to
 * text. SQLite remains able to compare those values with numeric bind values
 * while all new Supabase UUIDs can be stored without a datatype mismatch.
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`PRAGMA foreign_keys = OFF`);

  await db.execAsync(`
    CREATE TABLE medical_information_uuid (
      user_id TEXT NOT NULL PRIMARY KEY,
      server_id TEXT,
      email TEXT NOT NULL DEFAULT '',
      full_name TEXT,
      first_name TEXT,
      middle_name TEXT,
      last_name TEXT,
      suffix TEXT,
      date_of_birth TEXT,
      gender TEXT,
      phone_country_code TEXT,
      phone TEXT,
      blood_type TEXT,
      religion TEXT,
      address TEXT,
      no_blood_transfusion INTEGER NOT NULL DEFAULT 0,
      sync_status TEXT NOT NULL DEFAULT 'synced',
      updated_at_local TEXT NOT NULL,
      server_updated_at TEXT
    );

    INSERT INTO medical_information_uuid
    SELECT CAST(user_id AS TEXT), CAST(server_id AS TEXT), email, full_name,
      first_name, middle_name, last_name, suffix, date_of_birth, gender,
      phone_country_code, phone, blood_type, religion, address,
      no_blood_transfusion, sync_status, updated_at_local, server_updated_at
    FROM medical_information;

    DROP TABLE medical_information;
    ALTER TABLE medical_information_uuid RENAME TO medical_information;

    CREATE TABLE device_keys_uuid (
      user_id TEXT NOT NULL PRIMARY KEY,
      server_device_key_id TEXT,
      public_key TEXT NOT NULL,
      label TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      registered_at TEXT,
      pending_revoke_server_id TEXT,
      updated_at_local TEXT NOT NULL
    );

    INSERT INTO device_keys_uuid
    SELECT CAST(user_id AS TEXT), CAST(server_device_key_id AS TEXT), public_key,
      label, is_active, registered_at, CAST(pending_revoke_server_id AS TEXT),
      updated_at_local
    FROM device_keys;

    DROP TABLE device_keys;
    ALTER TABLE device_keys_uuid RENAME TO device_keys;

    CREATE TABLE my_scan_activity_uuid (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      scanner_fullname TEXT NOT NULL,
      scanned_at TEXT NOT NULL,
      synced_at TEXT NOT NULL
    );

    INSERT INTO my_scan_activity_uuid
    SELECT CAST(id AS TEXT), CAST(user_id AS TEXT), scanner_fullname, scanned_at, synced_at
    FROM my_scan_activity;

    DROP TABLE my_scan_activity;
    ALTER TABLE my_scan_activity_uuid RENAME TO my_scan_activity;

    CREATE INDEX idx_my_scan_activity_user
      ON my_scan_activity (user_id, scanned_at DESC);
  `);

  await db.execAsync(`PRAGMA foreign_keys = ON`);
}
