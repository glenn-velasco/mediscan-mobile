import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 14;

/**
 * Extends professional_attestations with a nullable matched_condition_local_uuid column so a
 * condition_verification attestation can link to a patient-authored condition the same way
 * allergy_verification links via matched_allergy_local_uuid (annotation-only, never overwrites
 * patient data — see migration 007's design notes).
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE professional_attestations ADD COLUMN matched_condition_local_uuid TEXT;
  `);
}
