import { getDb } from '@/db/client';
import { getCurrentUserId } from '@/db/context';
import type { MyScanActivityRow } from '@/db/schema';
import type { ScanActivity } from '@/api/types';

/**
 * Get all scan activity for the current user, ordered by most recent.
 */
export async function getAll(): Promise<MyScanActivityRow[]> {
  const db = await getDb();
  const userId = getCurrentUserId();
  return db.getAllAsync<MyScanActivityRow>(
    'SELECT * FROM my_scan_activity WHERE user_id = ? ORDER BY scanned_at DESC',
    userId,
  );
}

/**
 * Upsert a single scan event from API data.
 */
export async function upsertFromApi(item: ScanActivity): Promise<void> {
  const db = await getDb();
  const userId = getCurrentUserId();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO my_scan_activity (id, user_id, scanner_fullname, scanned_at, synced_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       scanner_fullname = excluded.scanner_fullname,
       scanned_at = excluded.scanned_at,
       synced_at = excluded.synced_at`,
    item.id,
    userId,
    item.scanner_fullname,
    item.scanned_at,
    now,
  );
}

/**
 * Upsert multiple scan events from API response.
 */
export async function upsertManyFromApi(items: ScanActivity[]): Promise<void> {
  for (const item of items) {
    await upsertFromApi(item);
  }
}

/**
 * Delete all scan activity for the current user (used on logout).
 */
export async function clearAll(): Promise<void> {
  const db = await getDb();
  const userId = getCurrentUserId();
  await db.runAsync('DELETE FROM my_scan_activity WHERE user_id = ?', userId);
}

/**
 * Convert a MyScanActivityRow to a ScanActivity for display.
 */
export function toScanActivity(row: MyScanActivityRow): ScanActivity {
  return {
    id: row.id,
    scanner_fullname: row.scanner_fullname,
    scanned_at: row.scanned_at,
  };
}
