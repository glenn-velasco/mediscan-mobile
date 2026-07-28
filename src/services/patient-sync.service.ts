import AsyncStorage from '@react-native-async-storage/async-storage';

import { NetworkError, UnauthenticatedError, ValidationError, getErrorStatus } from '@/api/errors';
import { getCachedToken } from '@/auth/token-storage';
import { getIsOffline } from '@/lib/network-state';
import { getCurrentUserId, hasCurrentUser } from '@/db/context';
import { backoffDelayMs } from '@/lib/backoff';
import { queryClient } from '@/lib/query-client';
import {
  allergiesQueryKey,
  conditionsQueryKey,
  diagnosesQueryKey,
  emergencyContactsQueryKey,
  medicalInformationQueryKey,
  medicationsQueryKey,
} from '@/lib/query-keys';

import * as allergiesRepo from '@/db/repositories/allergies.repo';
import * as conditionsRepo from '@/db/repositories/conditions.repo';
import * as diagnosesRepo from '@/db/repositories/diagnoses.repo';
import * as emergencyContactsRepo from '@/db/repositories/emergency-contacts.repo';
import * as medicalInformationRepo from '@/db/repositories/medical-information.repo';
import * as medicationsRepo from '@/db/repositories/medications.repo';

import { createAllergy, deleteAllergy, updateAllergy } from '@/api/endpoints/allergies';
import { createCondition, deleteCondition, updateCondition } from '@/api/endpoints/conditions';
import { createDiagnosis, deleteDiagnosis, updateDiagnosis } from '@/api/endpoints/diagnoses';
import {
  createEmergencyContact,
  deleteEmergencyContact,
  updateEmergencyContact,
} from '@/api/endpoints/emergency-contacts';
import { createMedicalInformation, updateMedicalInformation } from '@/api/endpoints/medical-information';
import { createMedication, deleteMedication, updateMedication } from '@/api/endpoints/medications';
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
function resetPatientSyncBackoff(): void {
  consecutiveFailures = 0;
  lastFailureAt = 0;
}

/** Clears the last-synced timestamp so the next login does a full pull instead of skipping data. */
export async function clearLastSyncedAt(): Promise<void> {
  if (!hasCurrentUser()) return;
  const userId = getCurrentUserId();
  await AsyncStorage.removeItem(`patient_sync_last_synced_at_${userId}`);
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
      } else if (getErrorStatus(err) === 404) {
        // 404 on CREATE means the endpoint/parent record doesn't exist yet — NOT that this record
        // was deleted. Skip for now and retry next cycle instead of hard-deleting (which would
        // destroy data that never existed server-side).
        console.warn(TAG, `create returned 404, will retry next cycle`, { localUuid: row.local_uuid });
        return;
      } else {
        throw err;
      }
    }
    await repo.markSyncedCreate(row.local_uuid, 1);
  } else {
    await api.update(row.local_uuid, payload);
  }
}

async function pushOne(
  tag: string,
  action: () => Promise<void>,
  localUuid: string,
  onNotFound: (localUuid: string) => Promise<void>,
): Promise<void> {
  try {
    await action();
  } catch (err) {
    if (err instanceof NetworkError || err instanceof UnauthenticatedError) throw err;
    // The server no longer has this record - most likely its parent medical_information record
    // was merged/deleted server-side (e.g. a registration-match accept moved it elsewhere, or an
    // admin deleted it). Retrying forever would just log the same 404 every cycle; drop the local
    // row instead since there's nothing left to reconcile it against.
    if (getErrorStatus(err) === 404) {
      console.warn(TAG, `${tag} no longer exists server-side, dropping local copy`, { localUuid });
      await onNotFound(localUuid);
      return;
    }
    console.warn(TAG, `failed to push ${tag}, will retry next cycle`, { localUuid, error: String(err) });
  }
}

async function pushAllergies(): Promise<void> {
  for (const row of await allergiesRepo.getAllForPush()) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    await pushOne(
      'allergy',
      () =>
        pushRecord(row, allergiesRepo.toPayload(row), { create: createAllergy, update: updateAllergy, remove: deleteAllergy }, {
          hardDelete: allergiesRepo.hardDelete,
          markSyncedCreate: allergiesRepo.markSyncedCreate,
        }),
      row.local_uuid,
      allergiesRepo.hardDelete,
    );
  }
}

async function pushConditions(): Promise<void> {
  for (const row of await conditionsRepo.getAllForPush()) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    await pushOne(
      'condition',
      () =>
        pushRecord(row, conditionsRepo.toPayload(row), { create: createCondition, update: updateCondition, remove: deleteCondition }, {
          hardDelete: conditionsRepo.hardDelete,
          markSyncedCreate: conditionsRepo.markSyncedCreate,
        }),
      row.local_uuid,
      conditionsRepo.hardDelete,
    );
  }
}

async function pushDiagnoses(): Promise<void> {
  const medicalInformation = await medicalInformationRepo.getLocal();
  const medicalInformationId = medicalInformation?.server_id;
  if (!medicalInformationId) return;

  for (const row of await diagnosesRepo.getAllForPush()) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    await pushOne(
      'diagnosis',
      () =>
        pushRecord(
          row,
          diagnosesRepo.toPayload(row),
          {
            create: (id, payload) => createDiagnosis(medicalInformationId, id, payload),
            update: updateDiagnosis,
            remove: deleteDiagnosis,
          },
          {
            hardDelete: diagnosesRepo.hardDelete,
            markSyncedCreate: diagnosesRepo.markSyncedCreate,
          },
        ),
      row.local_uuid,
      diagnosesRepo.hardDelete,
    );
  }
}

async function pushMedications(): Promise<void> {
  for (const row of await medicationsRepo.getAllForPush()) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    await pushOne(
      'medication',
      () =>
        pushRecord(row, medicationsRepo.toPayload(row), { create: createMedication, update: updateMedication, remove: deleteMedication }, {
          hardDelete: medicationsRepo.hardDelete,
          markSyncedCreate: medicationsRepo.markSyncedCreate,
        }),
      row.local_uuid,
      medicationsRepo.hardDelete,
    );
  }
}

async function pushEmergencyContacts(): Promise<void> {
  for (const row of await emergencyContactsRepo.getAllForPush()) {
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
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
      emergencyContactsRepo.hardDelete,
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
  if (getIsOffline()) return;
  if (isPushing) return;
  if (withinBackoffWindow()) return;

  isPushing = true;
  try {
    await pushMedicalInformation();
    await pushAllergies();
    await pushConditions();
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
 * Force-pushes all pending patient data before logout. Bypasses single-flight guard, backoff
 * window, and offline check — we want a last-ditch attempt to save data even if the network
 * state is flaky. Only skips if there's no token (already logged out).
 *
 * Called by AuthContext.logout() BEFORE clearing auth so pending changes aren't lost.
 * If the server is unreachable, changes stay in the local DB and sync on next login.
 */
export async function forcePushBeforeLogout(): Promise<void> {
  if (!getCachedToken()) return;
  if (!hasCurrentUser()) return;

  console.log(TAG, 'forcePushBeforeLogout: flushing all pending changes');
  try {
    await pushMedicalInformation();
    await pushAllergies();
    await pushConditions();
    await pushDiagnoses();
    await pushMedications();
    await pushEmergencyContacts();
    consecutiveFailures = 0;
    console.log(TAG, 'forcePushBeforeLogout: done');
  } catch (err) {
    console.warn(TAG, 'forcePushBeforeLogout: some data may not have synced', { error: String(err) });
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
  if (getIsOffline()) return;
  if (isPulling) return;
  if (withinBackoffWindow()) return;

  isPulling = true;
  try {
    const since = await getLastSyncedAt();
    console.debug(TAG, `pull: fetching changes since ${since ?? '(ever)'}`);
    const response = await pullSync(since);
    console.debug(TAG, `pull: received`, {
      allergies: response.allergies.length,
      conditions: response.conditions.length,
      diagnoses: response.diagnoses.length,
      medications: response.medications.length,
      emergency_contacts: response.emergency_contacts.length,
      medical_information: response.medical_information ? 'present' : 'null',
    });

    if (response.medical_information) {
      await medicalInformationRepo.saveFromServer(response.medical_information);
    }

    await Promise.all(response.allergies.map((record) =>
      record.deleted_at
        ? allergiesRepo.hardDelete(record.id)
        : allergiesRepo.upsertFromServer(record),
    ));

    await Promise.all(response.conditions.map((record) =>
      record.deleted_at
        ? conditionsRepo.hardDelete(record.id)
        : conditionsRepo.upsertFromServer(record),
    ));

    await Promise.all(response.diagnoses.map((record) =>
      record.deleted_at
        ? (console.debug(TAG, `pull: deleting diagnosis ${record.id}`), diagnosesRepo.hardDelete(record.id))
        : (console.debug(TAG, `pull: upserting diagnosis ${record.id}`, { condition: record.condition }), diagnosesRepo.upsertFromServer(record)),
    ));

    await Promise.all(response.medications.map((record) =>
      record.deleted_at
        ? medicationsRepo.hardDelete(record.id)
        : medicationsRepo.upsertFromServer(record),
    ));

    await Promise.all(response.emergency_contacts.map((record) =>
      record.deleted_at
        ? emergencyContactsRepo.hardDelete(record.id)
        : emergencyContactsRepo.upsertFromServer(record),
    ));

    await setLastSyncedAt(response.server_time);
    consecutiveFailures = 0;

    void Promise.resolve().then(() => {
      queryClient.invalidateQueries({ queryKey: medicalInformationQueryKey });
      queryClient.invalidateQueries({ queryKey: allergiesQueryKey });
      queryClient.invalidateQueries({ queryKey: conditionsQueryKey });
      queryClient.invalidateQueries({ queryKey: diagnosesQueryKey });
      queryClient.invalidateQueries({ queryKey: medicationsQueryKey });
      queryClient.invalidateQueries({ queryKey: emergencyContactsQueryKey });
    });
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
