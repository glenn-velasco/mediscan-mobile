import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 7;

/**
 * Decrypted, merged records from professional-submitted envelopes, kept separate from
 * allergies/medical_information rather than mutating those tables in place. This avoids a destructive
 * ALTER on encrypted-at-rest tables and avoids silently overwriting patient-authored data on an
 * imperfect allergen-name match — the UI annotates ("Verified by Dr. X") instead of overwriting.
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS professional_attestations (
      local_id TEXT PRIMARY KEY,
      source_envelope_local_id TEXT NOT NULL,
      envelope_type TEXT NOT NULL,
      encrypted_payload TEXT NOT NULL,
      matched_allergy_local_uuid TEXT,
      created_at TEXT NOT NULL
    );
  `);
}
