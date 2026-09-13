import type { SQLiteDatabase } from 'expo-sqlite';

export const version = 22;

export async function up(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('DROP TABLE IF EXISTS scan_metric_sessions;');
}
