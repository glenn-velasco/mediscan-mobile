import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 11;

/**
 * Replaces the single whole-row `encrypted_data` blob on each patient-data
 * table with one AES-encrypted column per PHI field (see `src/lib/crypto.ts`'s
 * `encryptField`/`decryptField`, added alongside this migration). The blob
 * was a SQLite workaround from migration 002 (no per-column cast system the
 * way Eloquent has server-side) - it meant reading any single field required
 * decrypting the whole row, and no field was individually inspectable. This
 * mirrors the server's `encrypted` Eloquent casts (one column per field),
 * so local storage and server storage now use the same shape even though
 * the actual keys/ciphertext are unrelated (device-local key vs `APP_KEY`).
 *
 * Drop-and-recreate, same strategy and same safety argument migration 002
 * used: local data is reconciled fresh from the server (`GET /me`, and once
 * `GET /sync` is wired up client-side, the same for allergies/diagnoses/
 * medications/emergency_contacts - see docs in the mediscan backend repo's
 * docs/SYNC.md) on next login/foreground, so nothing durable is lost - only
 * an unsynced local edit made offline right before this migration runs
 * would need to be re-entered. (For allergies/diagnoses/medications/
 * emergency_contacts specifically, this local-first sync loop isn't wired
 * up on the client yet as of this migration - safe to ship now since there
 * are no real user installs depending on it yet, but flagging the
 * distinction from medical_information's case, where reconciliation is
 * already live.)
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    DROP TABLE IF EXISTS medical_information;
    DROP TABLE IF EXISTS allergies;
    DROP TABLE IF EXISTS diagnoses;
    DROP TABLE IF EXISTS medications;
    DROP TABLE IF EXISTS emergency_contacts;

    CREATE TABLE medical_information (
      user_id INTEGER NOT NULL,
      server_id INTEGER,
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
      server_updated_at TEXT,
      PRIMARY KEY (user_id)
    );

    CREATE TABLE allergies (
      local_uuid TEXT PRIMARY KEY,
      server_id INTEGER,
      user_id INTEGER NOT NULL DEFAULT 0,
      allergen TEXT NOT NULL,
      reaction TEXT,
      severity TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      deleted_locally INTEGER NOT NULL DEFAULT 0,
      updated_at_local TEXT NOT NULL
    );

    CREATE TABLE diagnoses (
      local_uuid TEXT PRIMARY KEY,
      server_id INTEGER,
      user_id INTEGER NOT NULL DEFAULT 0,
      condition TEXT NOT NULL,
      date_of_diagnosis TEXT,
      severity TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      deleted_locally INTEGER NOT NULL DEFAULT 0,
      updated_at_local TEXT NOT NULL
    );

    CREATE TABLE medications (
      local_uuid TEXT PRIMARY KEY,
      server_id INTEGER,
      user_id INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL,
      dosage TEXT,
      frequency TEXT,
      notes TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      deleted_locally INTEGER NOT NULL DEFAULT 0,
      updated_at_local TEXT NOT NULL
    );

    CREATE TABLE emergency_contacts (
      local_uuid TEXT PRIMARY KEY,
      server_id INTEGER,
      user_id INTEGER NOT NULL DEFAULT 0,
      name TEXT NOT NULL,
      relationship TEXT,
      phone_country_code TEXT,
      phone TEXT,
      is_primary INTEGER NOT NULL DEFAULT 0,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      deleted_locally INTEGER NOT NULL DEFAULT 0,
      updated_at_local TEXT NOT NULL
    );
  `);
}
