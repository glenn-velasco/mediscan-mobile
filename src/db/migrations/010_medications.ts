import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 10;

/**
 * Medications — a peer data category to allergies/diagnoses (name, dosage, frequency, notes),
 * encrypted-at-rest with the same sync lifecycle. Also extends professional_attestations with a
 * nullable matched_medication_local_uuid column so a medication_verification attestation can link to
 * a patient-authored medication the same way allergy_verification links via matched_allergy_local_uuid
 * (annotation-only, never overwrites patient data — see migration 007's design notes). Created after
 * migration 009 added user_id to peer tables, so user_id is included directly here.
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS medications (
      local_uuid TEXT PRIMARY KEY,
      server_id INTEGER,
      user_id INTEGER NOT NULL DEFAULT 0,
      encrypted_data TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      deleted_locally INTEGER NOT NULL DEFAULT 0,
      updated_at_local TEXT NOT NULL
    );
  `);

  await db.execAsync(`
    ALTER TABLE professional_attestations ADD COLUMN matched_medication_local_uuid TEXT;
  `);
}
