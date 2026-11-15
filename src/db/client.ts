import { openDatabaseAsync, deleteDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { runMigrations } from '@/db/migrations';

export type { SQLiteDatabase };

let dbPromise: Promise<SQLiteDatabase> | null = null;
let isClosing = false;
let webReleasePromise: Promise<void> | null = null;
let releaseWebOwnership: (() => void) | null = null;
let webOwnershipPromise: Promise<void> | null = null;
let webOwnershipAbortController: AbortController | null = null;

const WEB_OPEN_RETRY_DELAYS_MS = [100, 250, 500, 1_000, 2_000] as const;
const WEB_DATABASE_LOCK_NAME = 'mediscan-sqlite-owner';

type WebSQLiteGlobal = typeof globalThis & {
  __EXPO_SQLITE_RELEASE_WEB_WORKER__?: () => Promise<void>;
};

type WebLockManager = {
  request: (
    name: string,
    options: { mode: 'exclusive'; signal: AbortSignal },
    callback: () => Promise<void>,
  ) => Promise<void>;
};

function isWeb(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function waitUntilVisible(): Promise<void> {
  if (!isWeb() || document.visibilityState !== 'hidden') return Promise.resolve();
  return new Promise((resolve) => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') return;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      resolve();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
  });
}

async function acquireWebOwnership(): Promise<void> {
  if (!isWeb() || releaseWebOwnership) return;
  if (webOwnershipPromise) return webOwnershipPromise;
  await waitUntilVisible();

  const lockManager = (navigator as Navigator & { locks?: WebLockManager }).locks;
  if (!lockManager) return;

  const abortController = new AbortController();
  webOwnershipAbortController = abortController;
  webOwnershipPromise = new Promise<void>((resolve, reject) => {
    let acquired = false;
    void lockManager.request(
      WEB_DATABASE_LOCK_NAME,
      { mode: 'exclusive', signal: abortController.signal },
      async () => {
        acquired = true;
        await new Promise<void>((release) => {
          releaseWebOwnership = release;
          resolve();
        });
      },
    ).catch((error) => {
      if (!acquired) reject(error);
    });
  }).finally(() => {
    webOwnershipPromise = null;
    if (webOwnershipAbortController === abortController) webOwnershipAbortController = null;
  });
  return webOwnershipPromise;
}

async function releaseWebDatabase(): Promise<void> {
  if (!isWeb()) return;
  if (webReleasePromise) return webReleasePromise;

  webOwnershipAbortController?.abort();
  webOwnershipAbortController = null;
  const activeDbPromise = dbPromise;
  dbPromise = null;
  isClosing = true;

  webReleasePromise = (async () => {
    try {
      if (activeDbPromise) {
        const db = await activeDbPromise.catch(() => null);
        await db?.closeAsync().catch(() => {});
      }
      const releaseWorker = (globalThis as WebSQLiteGlobal).__EXPO_SQLITE_RELEASE_WEB_WORKER__;
      await releaseWorker?.().catch(() => {});
    } finally {
      releaseWebOwnership?.();
      releaseWebOwnership = null;
      isClosing = false;
      webReleasePromise = null;
    }
  })();
  return webReleasePromise;
}

function isRecoverableWebOpenError(error: unknown): boolean {
  if (!isWeb()) return false;
  const name = error instanceof DOMException ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  return name === 'NoModificationAllowedError'
    || message.includes('NoModificationAllowedError')
    || message.includes('Invalid VFS state');
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openDb(): Promise<SQLiteDatabase> {
  console.log('[DB] getDb(): opening database');
  const db = await openDatabaseAsync('mediscan.db');

  try {
    console.log('[DB] getDb(): database opened, setting PRAGMAs');
    // Default rollback-journal mode takes an exclusive file lock per write transaction, and the
    // default busy_timeout of 0 means any concurrent statement on this connection fails instantly
    // as "database is locked" instead of waiting — easy to hit since several independent
    // repos/services (sync triggers, device-key registration, ...) all query this same singleton
    // connection concurrently during app boot. WAL lets reads proceed alongside a writer, and
    // busy_timeout makes SQLite retry internally for up to 5s before giving up.
    try {
      await db.execAsync('PRAGMA journal_mode = WAL;');
      await db.execAsync('PRAGMA busy_timeout = 5000;');
    } catch (pragmaErr) {
      console.warn('[DB] getDb(): PRAGMA setup skipped on this platform', pragmaErr);
    }
    console.log('[DB] getDb(): PRAGMAs set, running migrations');
    await runMigrations(db);
    console.log('[DB] getDb(): migrations complete');
    return db;
  } catch (err) {
    // If setup fails after SQLite opened, release the native/web handle before allowing a retry.
    await db.closeAsync().catch(() => {});
    throw err;
  }
}

async function openDbWithRecovery(): Promise<SQLiteDatabase> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await openDb();
    } catch (error) {
      const delay = WEB_OPEN_RETRY_DELAYS_MS[attempt];
      if (delay === undefined || !isRecoverableWebOpenError(error)) throw error;
      console.warn(`[DB] Web storage is temporarily busy; retrying in ${delay}ms`);
      await wait(delay);
    }
  }
}

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
    dbPromise = (async () => {
      await acquireWebOwnership();
      return openDbWithRecovery();
    })().catch((err) => {
      // Do not permanently cache a rejected promise. On web, another tab can briefly own Expo
      // SQLite's OPFS access handle; once it releases the handle, the next hydration can retry.
      dbPromise = null;
      console.error('[DB] getDb(): FAILED', err);
      throw err;
    });
  }
  return dbPromise;
}

if (isWeb()) {
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') void releaseWebDatabase();
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('pagehide', () => {
    void releaseWebDatabase();
  });
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

// Keep initialization lazy. Auth-only web pages (forgot/reset password) can remain open in another
// tab; opening Expo SQLite there would hold the OPFS access handle and prevent the authenticated
// dashboard tab from loading the user's local data.
