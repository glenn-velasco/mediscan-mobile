import { NetworkError, UnauthenticatedError } from '@/api/errors';
import { getMyScanActivity } from '@/api/endpoints/my-scan-activity';
import * as myScanActivityRepo from '@/db/repositories/my-scan-activity.repo';
import { queryClient } from '@/lib/query-client';
import { myScanActivityQueryKey } from '@/lib/query-keys';
import { getIsOffline } from '@/lib/network-state';

const TAG = '[MyScanActivitySync]';

let isSyncing = false;

/**
 * Pull scan activity from the API and upsert into local SQLite.
 * Read-only sync — patients don't create scan records.
 */
export async function pullMyScanActivity(): Promise<void> {
  if (isSyncing) return;
  if (getIsOffline()) return;

  isSyncing = true;
  try {
    const response = await getMyScanActivity({ per_page: 100 });
    const events = response?.data;
    if (Array.isArray(events) && events.length > 0) {
      await myScanActivityRepo.upsertManyFromApi(events);
      queryClient.invalidateQueries({ queryKey: myScanActivityQueryKey });
      console.debug(`${TAG} Synced ${events.length} scan events`);
    }
  } catch (error) {
    if (error instanceof UnauthenticatedError || error instanceof NetworkError) {
      console.debug(`${TAG} Sync skipped:`, error.constructor.name);
    } else {
      console.warn(`${TAG} Sync failed:`, error);
    }
  } finally {
    isSyncing = false;
  }
}
