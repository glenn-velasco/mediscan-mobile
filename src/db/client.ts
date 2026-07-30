import { openDatabaseAsync, deleteDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from '@/db/migrations';

export type { SQLiteDatabase };

let dbPromise: Promise<SQLiteDatabase> | null = null;
let isClosing = false;

export function getDb(): Promise<SQLiteDatabase> {
  if (isClosing) {
    // Wait for close to finish before reopening
    return new Promise((resolve) => {
      const check = () => {
        if (!isClosing) {
          resolve(getDb());
        } else {
          setTimeout(check, 10);
        }
      };
      check();
    });
  }

  if (!dbPromise) {
    console.log('[DB] getDb(): opening database');
    dbPromise = openDatabaseAsync('mediscan.db').then(async (db) => {
      console.log('[DB] getDb(): database opened, setting PRAGMAs');
      // Default rollback-journal mode takes an exclusive file lock per write transaction, and the
      // default busy_timeout of 0 means any concurrent statement on this connection fails instantly
      // as "database is locked" instead of waiting — easy to hit since several independent
      // repos/services (sync triggers, device-key registration, ...) all query this same singleton
      // connection concurrently during app boot. WAL lets reads proceed alongside a writer, and
      // busy_timeout makes SQLite retry internally for up to 5s before giving up.
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA busy_timeout = 5000;');
      console.log('[DB] getDb(): PRAGMAs set, running migrations');
      await runMigrations(db);
      console.log('[DB] getDb(): migrations complete');
      return db;
    }).catch((err) => {
      console.error('[DB] getDb(): FAILED', err);
      throw err;
    });
  }
  return dbPromise;
}

/** Closes the current connection and deletes the database file. The next getDb() call re-creates it. */
export async function resetDb(): Promise<void> {
  if (isClosing) return;
  isClosing = true;
  try {
    if (dbPromise) {
      const db = await dbPromise;
      await db.closeAsync();
    }
  } catch (err) {
    // Database might still be in use by background sync — log and continue.
    // The next login will overwrite the data anyway.
    console.warn('[resetDb] Failed to close database, continuing', err);
  } finally {
    dbPromise = null;
    isClosing = false;
  }
  try {
    await deleteDatabaseAsync('mediscan.db');
  } catch {
    // Ignore delete errors
  }
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
    isClosing = true;
    dbPromise
      ?.then((db) => db.closeAsync())
      .catch(() => {})
      .finally(() => {
        dbPromise = null;
        isClosing = false;
      });
  });
}

// Kick off DB initialization at module load so it's ready by the time components mount.
// All callers go through getDb() which returns this same cached promise.
void getDb();
