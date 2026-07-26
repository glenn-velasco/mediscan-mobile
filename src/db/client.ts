import { openDatabaseAsync, deleteDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from '@/db/migrations';

let dbPromise: Promise<SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabaseAsync('mediscan.db').then(async (db) => {
      // Default rollback-journal mode takes an exclusive file lock per write transaction, and the
      // default busy_timeout of 0 means any concurrent statement on this connection fails instantly
      // as "database is locked" instead of waiting — easy to hit since several independent
      // repos/services (sync triggers, device-key registration, ...) all query this same singleton
      // connection concurrently during app boot. WAL lets reads proceed alongside a writer, and
      // busy_timeout makes SQLite retry internally for up to 5s before giving up.
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA busy_timeout = 5000;');
      await runMigrations(db);
      return db;
    });
  }
  return dbPromise;
}

/** Closes the current connection and deletes the database file. The next getDb() call re-creates it. */
export async function resetDb(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    await db.closeAsync();
  }
  dbPromise = null;
  await deleteDatabaseAsync('mediscan.db');
}

// Metro Fast Refresh re-evaluates this module on edit, resetting `dbPromise` to null — but the
// native SQLite connection above isn't tied to JS module lifetime and stays open, so the next
// getDb() call opens a second connection against the same file and collides with the first
// (surfaces as "database is locked" on the new connection's own PRAGMA/setup statements). Close
// the stale connection before Fast Refresh discards this module so only one connection is ever
// open at a time in dev.
if (__DEV__) {
  const hot = (module as unknown as { hot?: { dispose: (cb: () => void) => void } }).hot;
  hot?.dispose(() => {
    dbPromise?.then((db) => db.closeAsync()).catch(() => {});
    dbPromise = null;
  });
}
