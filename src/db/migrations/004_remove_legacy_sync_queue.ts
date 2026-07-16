import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 4;

/**
 * The server no longer accepts patient-authored writes (medical-information/allergies/emergency-contacts
 * write endpoints were removed in the encrypted-relay pivot), so the mutation-queue outbox this table
 * backed has no server to sync against anymore. Dropping it also clears out the PHI it held in its
 * `payload` column now that nothing reads it.
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`DROP TABLE IF EXISTS mutation_queue;`);
}
