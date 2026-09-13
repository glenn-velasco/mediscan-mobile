import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 23;

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DROP TABLE IF EXISTS emergency_profile_settings;');
}
