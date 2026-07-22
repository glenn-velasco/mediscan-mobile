import AsyncStorage from '@react-native-async-storage/async-storage';

import { hasCurrentUser, getCurrentUserId } from '@/db/context';
import { getCachedToken } from '@/auth/token-storage';
import { NetworkError, UnauthenticatedError, ValidationError } from '@/api/errors';
import { backoffDelayMs } from '@/lib/backoff';
import { queryClient } from '@/lib/query-client';
import {
  allergiesQueryKey,
  diagnosesQueryKey,
  medicationsQueryKey,
  emergencyContactsQueryKey,
  medicalInformationQueryKey,
} from '@/lib/query-keys';

import * as allergiesRepo from '@/db/repositories/allergies.repo';
import * as diagnosesRepo from '@/db/repositories/diagnoses.repo';
import * as medicationsRepo from '@/db/repositories/medications.repo';
import * as emergencyContactsRepo from '@/db/repositories/emergency-contacts.repo';
import * as medicalInformationRepo from '@/db/repositories/medical-information.repo';

import { createAllergy, updateAllergy, deleteAllergy } from '@/api/endpoints/allergies';
import { createDiagnosis, updateDiagnosis, deleteDiagnosis } from '@/api/endpoints/diagnoses';
import { createMedication, updateMedication, deleteMedication } from '@/api/endpoints/medications';
import {
  createEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact,
} from '@/api/endpoints/emergency-contacts';
import { createMedicalInformation, updateMedicalInformation } from '@/api/endpoints/medical-information';
import { pullSync } from '@/api/endpoints/sync';

const TAG = '[PatientSyncService]';

/**
 * Patient-authored CRUD sync — a second, independent sync system from the BLE/envelope/
 * professional-attestation flow (`pending-sync.service.ts`/`merge.service.ts`), which this doesn't
 * touch. See the backend repo's docs/SYNC.md for the full architecture (why client-generated UUIDs
 * are the real server primary key, last-write-wins conflict resolution, etc.).
 */

let isPushing = false;
let isPulling = false;
let consecutiveFailures = 0;
let lastFailureAt = 0;

function withinBackoffWindow(): boolean {
  if (consecutiveFailures === 0) return false;
  return Date.now() < lastFailureAt + backoffDelayMs(consecutiveFailures - 1);
}

/** Clears the retry backoff so a fresh login doesn't inherit a stale delay from before the user logged out. */
export function resetPatientSyncBackoff(): void {
  consecutiveFailures = 0;
  lastFailureAt = 0;
}

function lastSyncedAtKey(): string {
  return `patient_sync_last_synced_at_${getCurrentUserId()}`;
}

async function getLastSyncedAt(): Promise<string | undefined> {
  const value = await AsyncStorage.getItem(lastSyncedAtKey());
  return value ?? undefined;
}

async function setLastSyncedAt(value: string): Promise<void> {
  await AsyncStorage.setItem(lastSyncedAtKey(), value);
}

/**
 * Shared push-one-record logic for the four peer resources (medical_information has its own path -
 * see `pushMedicalInformation` - since its local key isn't a client-generated UUID).
 *
 * `row.server_id` is repurposed here as a plain "has this been pushed to the server at least once"
 * flag (truthy/falsy), not a real foreign id the way the old envelope-era design used it — under the
 * new backend, the server's id for these four resources IS `local_uuid`, so there's nothing else to
 * store there. See the `allergies` migration's comment for the id design.
 */
async function pushRecord<TPayload>(
  row: { local_uuid: string; server_id: number | null; deleted_locally: 0 | 1 },
  payload: TPayload,
  api: {
    create: (id: string, payload: TPayload) => Promise<unknown>;
    update: (id: string, payload: TPayload) => Promise<unknown>;
    remove: (id: string) => Promise<unknown>;
  },
  repo: {
    hardDelete: (id: string) => Promise<void>;
    markSyncedCreate: (id: string, serverId: number) => Promise<void>;
  },
): Promise<void> {
  if (row.deleted_locally) {
    if (row.server_id) await api.remove(row.local_uuid);
    await repo.hardDelete(row.local_uuid);
    return;
  }

  if (!row.server_id) {
    try {
      await api.create(row.local_uuid, payload);
    } catch (err) {
      // The id already exists server-side — most likely a create that actually succeeded but this
      // device never heard back (dropped connection right after the response). Fall back to update
      // instead of leaving the row stuck unsynced forever.
      if (err instanceof ValidationError) {
        await api.update(row.local_uuid, payload);
      } else {
        throw err;
      }
    }
    await repo.markSyncedCreate(row.local_uuid, 1);
  } else {
    await api.update(row.local_uuid, payload);
  }
}

async function pushOne(tag: string, action: () => Promise<void>, localUuid: string): Promise<void> {
  try {
    await action();
  } catch (err) {
    if (err instanceof NetworkError || err instanceof UnauthenticatedError) throw err;
    console.warn(TAG, `failed to push ${tag}, will retry next cycle`, { localUuid, error: String(err) });
  }
}

async function pushAllergies(): Promise<void> {
  for (const row of await allergiesRepo.getAllForPush()) {
    await pushOne(
      'allergy',
      () =>
        pushRecord(row, allergiesRepo.toPayload(row), { create: createAllergy, update: updateAllergy, remove: deleteAllergy }, {
          hardDelete: allergiesRepo.hardDelete,
          markSyncedCreate: allergiesRepo.markSyncedCreate,
        }),
      row.local_uuid,
    );
  }
}

async function pushDiagnoses(): Promise<void> {
  for (const row of await diagnosesRepo.getAllForPush()) {
    await pushOne(
      'diagnosis',
      () =>
        pushRecord(row, diagnosesRepo.toPayload(row), { create: createDiagnosis, update: updateDiagnosis, remove: deleteDiagnosis }, {
          hardDelete: diagnosesRepo.hardDelete,
          markSyncedCreate: diagnosesRepo.markSyncedCreate,
        }),
      row.local_uuid,
    );
  }
}

async function pushMedications(): Promise<void> {
  for (const row of await medicationsRepo.getAllForPush()) {
    await pushOne(
      'medication',
      () =>
        pushRecord(row, medicationsRepo.toPayload(row), { create: createMedication, update: updateMedication, remove: deleteMedication }, {
          hardDelete: medicationsRepo.hardDelete,
          markSyncedCreate: medicationsRepo.markSyncedCreate,
        }),
      row.local_uuid,
    );
  }
}

async function pushEmergencyContacts(): Promise<void> {
  for (const row of await emergencyContactsRepo.getAllForPush()) {
    await pushOne(
      'emergency contact',
      () =>
        pushRecord(
          row,
          emergencyContactsRepo.toPayload(row),
          { create: createEmergencyContact, update: updateEmergencyContact, remove: deleteEmergencyContact },
          { hardDelete: emergencyContactsRepo.hardDelete, markSyncedCreate: emergencyContactsRepo.markSyncedCreate },
        ),
      row.local_uuid,
    );
  }
}

async function pushMedicalInformation(): Promise<void> {
  const row = await medicalInformationRepo.getLocal();
  if (!row || row.sync_status !== 'pending') return;

  try {
    const payload = medicalInformationRepo.toPayload(row);
    if (!row.server_id) {
      await createMedicalInformation(payload);
    } else {
      await updateMedicalInformation(row.server_id, payload);
    }
    await medicalInformationRepo.markSynced();
  } catch (err) {
    if (err instanceof NetworkError || err instanceof UnauthenticatedError) throw err;
    console.warn(TAG, 'failed to push medical information, will retry next cycle', { error: String(err) });
  }
}

/** Pushes every locally-pending patient-authored change to the cloud API. Single-flight guarded. */
export async function pushPatientChanges(): Promise<void> {
  if (!getCachedToken()) return;
  if (!hasCurrentUser()) return;
  if (isPushing) return;
  if (withinBackoffWindow()) return;

  isPushing = true;
  try {
    await pushMedicalInformation();
    await pushAllergies();
    await pushDiagnoses();
    await pushMedications();
    await pushEmergencyContacts();
    consecutiveFailures = 0;
  } catch (err) {
    if (err instanceof NetworkError || err instanceof UnauthenticatedError) {
      consecutiveFailures += 1;
      lastFailureAt = Date.now();
      console.warn(TAG, 'push failed, will retry on next trigger', { error: String(err), consecutiveFailures });
    } else {
      console.error(TAG, 'unexpected error during push', { error: String(err) });
    }
  } finally {
    isPushing = false;
  }
}

/**
 * Pulls everything changed server-side since the last successful pull and applies it locally.
 * Last-write-wins: whatever the server returns unconditionally overwrites the matching local row
 * (see each repo's `upsertFromServer`/`saveFromServer`) — this is where the losing side of a
 * same-record conflict finds out it lost. Single-flight guarded.
 */
export async function pullPatientChanges(): Promise<void> {
  if (!getCachedToken()) return;
  if (!hasCurrentUser()) return;
  if (isPulling) return;
  if (withinBackoffWindow()) return;

  isPulling = true;
  try {
    const since = await getLastSyncedAt();
    const response = await pullSync(since);

    if (response.medical_information) {
      await medicalInformationRepo.saveFromServer(response.medical_information);
    }

    for (const record of response.allergies) {
      if (record.deleted_at) {
        await allergiesRepo.hardDelete(record.id);
      } else {
        await allergiesRepo.upsertFromServer(record);
      }
    }

    for (const record of response.diagnoses) {
      if (record.deleted_at) {
        await diagnosesRepo.hardDelete(record.id);
      } else {
        await diagnosesRepo.upsertFromServer(record);
      }
    }

    for (const record of response.medications) {
      if (record.deleted_at) {
        await medicationsRepo.hardDelete(record.id);
      } else {
        await medicationsRepo.upsertFromServer(record);
      }
    }

    for (const record of response.emergency_contacts) {
      if (record.deleted_at) {
        await emergencyContactsRepo.hardDelete(record.id);
      } else {
        await emergencyContactsRepo.upsertFromServer(record);
      }
    }

    await setLastSyncedAt(response.server_time);
    consecutiveFailures = 0;

    queryClient.invalidateQueries({ queryKey: medicalInformationQueryKey });
    queryClient.invalidateQueries({ queryKey: allergiesQueryKey });
    queryClient.invalidateQueries({ queryKey: diagnosesQueryKey });
    queryClient.invalidateQueries({ queryKey: medicationsQueryKey });
    queryClient.invalidateQueries({ queryKey: emergencyContactsQueryKey });
  } catch (err) {
    if (err instanceof NetworkError || err instanceof UnauthenticatedError) {
      consecutiveFailures += 1;
      lastFailureAt = Date.now();
      console.warn(TAG, 'pull failed, will retry on next trigger', { error: String(err), consecutiveFailures });
    } else {
      console.error(TAG, 'unexpected error during pull', { error: String(err) });
    }
  } finally {
    isPulling = false;
  }
}
