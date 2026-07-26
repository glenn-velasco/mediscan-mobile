import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 8;

/**
 * Medical diagnoses — a peer data category to allergies (condition, date of diagnosis, severity),
 * encrypted-at-rest with the same sync lifecycle. Also extends professional_attestations with a
 * nullable matched_diagnosis_local_uuid column so a diagnosis_verification attestation can link to
 * a patient-authored diagnosis the same way allergy_verification links via matched_allergy_local_uuid
 * (annotation-only, never overwrites patient data — see migration 007's design notes).
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS diagnoses (
      local_uuid TEXT PRIMARY KEY,
      server_id INTEGER,
      encrypted_data TEXT NOT NULL,
      sync_status TEXT NOT NULL DEFAULT 'pending',
      deleted_locally INTEGER NOT NULL DEFAULT 0,
      updated_at_local TEXT NOT NULL
    );
  `);

  await db.execAsync(`
    ALTER TABLE professional_attestations ADD COLUMN matched_diagnosis_local_uuid TEXT;
  `);
}
