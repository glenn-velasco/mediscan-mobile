import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from '@/db/migrations';

let dbPromise: Promise<SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync('mediscan.db').then(async (db) => {
      await runMigrations(db);
      return db;
    });
  }
  return dbPromise;
}
