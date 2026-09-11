import { NetworkError, UnauthenticatedError } from '@/api/errors';
import { getScannedPatients } from '@/api/endpoints/professional-scans';
import * as scannedPatientsRepo from '@/db/repositories/scanned-patients.repo';
import { queryClient } from '@/lib/query-client';
import { professionalScansQueryKey } from '@/lib/query-keys';
import { getIsOffline } from '@/lib/network-state';
import { loadUser } from '@/auth/user-storage';

const TAG = '[ScannedPatientsSync]';

let isSyncing = false;

/**
 * Pull scanned patients from the API and upsert into local SQLite.
 * Read-only sync — no push needed since professionals don't create scan records.
 * Only runs for verified professionals (the endpoint requires the ability).
 */
export async function pullScannedPatients(): Promise<void> {
  if (isSyncing) return;
  if (getIsOffline()) return;

  const user = await loadUser();
  if (!user?.permissions?.includes('verified professional')) return;

  isSyncing = true;
  try {
    const response = await getScannedPatients({ per_page: 100 });
    const patients = response?.data;
    if (Array.isArray(patients) && patients.length > 0) {
      await scannedPatientsRepo.upsertManyFromApi(patients);
      queryClient.invalidateQueries({ queryKey: professionalScansQueryKey });
      console.debug(`${TAG} Synced ${patients.length} scanned patients`);
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
