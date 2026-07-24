import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 16;

/**
 * Adds `verified_by` JSON column to allergies, conditions, diagnoses, and medications tables.
 * This enables tracking which professionals have verified each record locally,
 * supporting both BLE and server sync paths.
 *
 * Structure: [{ user_id: number, name: string, verified_at: string }]
 */
export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    ALTER TABLE allergies ADD COLUMN verified_by TEXT;
    ALTER TABLE conditions ADD COLUMN verified_by TEXT;
    ALTER TABLE diagnoses ADD COLUMN verified_by TEXT;
    ALTER TABLE medications ADD COLUMN verified_by TEXT;
  `);
}
