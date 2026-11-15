import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  NetworkError,
  UnauthenticatedError,
  ValidationError,
  getErrorStatus,
} from "@/api/errors";
import { getCachedToken } from "@/auth/token-storage";
import { getIsOffline } from "@/lib/network-state";
import { getCurrentUserId, hasCurrentUser } from "@/db/context";
import { backoffDelayMs } from "@/lib/backoff";
import { queryClient } from "@/lib/query-client";
import {
  allergiesQueryKey,
  conditionsQueryKey,
  diagnosesQueryKey,
  emergencyContactsQueryKey,
  medicalInformationQueryKey,
  medicationsQueryKey,
} from "@/lib/query-keys";

import * as allergiesRepo from "@/db/repositories/allergies.repo";
import * as conditionsRepo from "@/db/repositories/conditions.repo";
import * as diagnosesRepo from "@/db/repositories/diagnoses.repo";
import * as emergencyContactsRepo from "@/db/repositories/emergency-contacts.repo";
import * as medicalInformationRepo from "@/db/repositories/medical-information.repo";
import * as emergencyHistoryRepo from "@/db/repositories/emergency-field-history.repo";
import * as medicationsRepo from "@/db/repositories/medications.repo";

import {
  createAllergy,
  deleteAllergy,
  updateAllergy,
} from "@/api/endpoints/allergies";
import {
  createCondition,
  deleteCondition,
  updateCondition,
} from "@/api/endpoints/conditions";
import {
  createDiagnosis,
  deleteDiagnosis,
  updateDiagnosis,
} from "@/api/endpoints/diagnoses";
import {
  createEmergencyContact,
  deleteEmergencyContact,
  updateEmergencyContact,
} from "@/api/endpoints/emergency-contacts";
import {
  createMedicalInformation,
  updateMedicalInformation,
} from "@/api/endpoints/medical-information";
import {
  createMedication,
  deleteMedication,
  updateMedication,
} from "@/api/endpoints/medications";
import { pullSync } from "@/api/endpoints/sync";
import {
  pullEmergencyFieldHistory,
  pushEmergencyFieldHistory,
} from "@/api/endpoints/emergency-field-history";

const TAG = "[PatientSyncService]";

/**
 * Patient-authored CRUD sync — a second, independent sync system from the BLE/envelope/
 * professional-attestation flow (`pending-sync.service.ts`/`merge.service.ts`), which this doesn't
 * touch. See the backend repo's docs/SYNC.md for the full architecture (why client-generated UUIDs
 * are the real server primary key, last-write-wins conflict resolution, etc.).
 */

type ActivePatientSyncTask = {
  userId: string;
  task: Promise<void>;
};

let activePush: ActivePatientSyncTask | null = null;
let activePull: ActivePatientSyncTask | null = null;
let consecutiveFailures = 0;
let lastFailureAt = 0;
const lastHistoryPullByUser = new Map<string, number>();
const HISTORY_PULL_INTERVAL_MS = 5 * 60 * 1000;

async function pushEmergencyHistory(userId: string): Promise<void> {
  // Do not publish a change log ahead of the current patient record it describes.
  if ((await medicalInformationRepo.getByUserId(userId))?.sync_status === "pending")
    return;
  while (true) {
    assertCurrentPatientUser(userId);
    const pending = await emergencyHistoryRepo.getPending(50, userId);
    if (!pending.length) return;
    const result = await pushEmergencyFieldHistory(pending);
    assertCurrentPatientUser(userId);
    if (result.recorded.length !== pending.length)
      throw new Error("Some emergency history events were not accepted");
    await emergencyHistoryRepo.markSynced(result.recorded, userId);
    void queryClient.invalidateQueries({
      queryKey: ["emergency-field-history", userId],
    });
    if (pending.length < 50) return;
  }
}

async function pullEmergencyHistoryIfDue(userId: string): Promise<void> {
  assertCurrentPatientUser(userId);
  const now = Date.now();
  if (now - (lastHistoryPullByUser.get(userId) ?? 0) < HISTORY_PULL_INTERVAL_MS)
    return;
  const events = await pullEmergencyFieldHistory();
  assertCurrentPatientUser(userId);
  const inserted = await emergencyHistoryRepo.cacheServerChanges(events, userId);
  lastHistoryPullByUser.set(userId, now);
  if (inserted)
    void queryClient.invalidateQueries({
      queryKey: ["emergency-field-history", userId],
    });
}

function withinBackoffWindow(): boolean {
  if (consecutiveFailures === 0) return false;
  return Date.now() < lastFailureAt + backoffDelayMs(consecutiveFailures - 1);
}

/** Clears the retry backoff so a fresh login doesn't inherit a stale delay from before the user logged out. */
export function resetPatientSyncBackoff(): void {
  consecutiveFailures = 0;
  lastFailureAt = 0;
}

/** Clears the last-synced timestamp so the next login does a full pull instead of skipping data. */
export async function clearLastSyncedAt(userId?: string | number): Promise<void> {
  if (userId === undefined && !hasCurrentUser()) return;
  const resolvedUserId = userId ?? getCurrentUserId();
  await AsyncStorage.removeItem(`patient_sync_last_synced_at_${resolvedUserId}`);
}

function lastSyncedAtKey(userId: string | number): string {
  return `patient_sync_last_synced_at_${userId}`;
}

async function getLastSyncedAt(userId: string | number): Promise<string | undefined> {
  const value = await AsyncStorage.getItem(lastSyncedAtKey(userId));
  return value ?? undefined;
}

async function setLastSyncedAt(userId: string | number, value: string): Promise<void> {
  await AsyncStorage.setItem(lastSyncedAtKey(userId), value);
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
  row: {
    local_uuid: string;
    server_id: number | null;
    deleted_locally: 0 | 1;
    updated_at_local: string;
  },
  payload: TPayload,
  api: {
    create: (id: string, payload: TPayload) => Promise<unknown>;
    update: (id: string, payload: TPayload) => Promise<unknown>;
    remove: (id: string) => Promise<unknown>;
  },
  repo: {
    hardDelete: (id: string) => Promise<void>;
    markSyncedCreate: (
      id: string,
      serverId: number,
      expectedUpdatedAt?: string,
    ) => Promise<void>;
    markSynced: (id: string, expectedUpdatedAt?: string) => Promise<void>;
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
      } else if (
        typeof getErrorStatus === "function" &&
        getErrorStatus(err) === 404
      ) {
        // 404 on CREATE means the endpoint/parent record doesn't exist yet — NOT that this record
        // was deleted. Skip for now and retry next cycle instead of hard-deleting (which would
        // destroy data that never existed server-side).
        console.warn(TAG, `create returned 404, will retry next cycle`, {
          localUuid: row.local_uuid,
        });
        return;
      } else {
        throw err;
      }
    }
    await repo.markSyncedCreate(row.local_uuid, 1, row.updated_at_local);
  } else {
    await api.update(row.local_uuid, payload);
    await repo.markSynced(row.local_uuid, row.updated_at_local);
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
    if (err instanceof NetworkError || err instanceof UnauthenticatedError)
      throw err;
    // The server no longer has this record - most likely its parent medical_information record
    // was merged/deleted server-side (e.g. a registration-match accept moved it elsewhere, or an
    // admin deleted it). Retrying forever would just log the same 404 every cycle; drop the local
    // row instead since there's nothing left to reconcile it against.
    if (typeof getErrorStatus === "function" && getErrorStatus(err) === 404) {
      console.warn(
        TAG,
        `${tag} no longer exists server-side, dropping local copy`,
        { localUuid },
      );
      await onNotFound(localUuid);
      return;
    }
    console.warn(TAG, `failed to push ${tag}, will retry next cycle`, {
      localUuid,
      error: String(err),
    });
  }
}

async function pushAllergies(userId: string): Promise<void> {
  for (const row of await allergiesRepo.getAllForPush(userId)) {
    assertCurrentPatientUser(userId);
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    await pushOne(
      "allergy",
      () =>
        pushRecord(
          row,
          allergiesRepo.toPayload(row),
          {
            create: createAllergy,
            update: updateAllergy,
            remove: deleteAllergy,
          },
          {
            hardDelete: (id) => allergiesRepo.hardDelete(id, userId),
            markSyncedCreate: (id, serverId, expectedUpdatedAt) =>
              allergiesRepo.markSyncedCreate(id, serverId, expectedUpdatedAt, userId),
            markSynced: (id, expectedUpdatedAt) =>
              allergiesRepo.markSynced(id, expectedUpdatedAt, userId),
          },
        ),
      row.local_uuid,
      (id) => allergiesRepo.hardDelete(id, userId),
    );
  }
}

async function pushConditions(userId: string): Promise<void> {
  for (const row of await conditionsRepo.getAllForPush(userId)) {
    assertCurrentPatientUser(userId);
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    await pushOne(
      "condition",
      () =>
        pushRecord(
          row,
          conditionsRepo.toPayload(row),
          {
            create: createCondition,
            update: updateCondition,
            remove: deleteCondition,
          },
          {
            hardDelete: (id) => conditionsRepo.hardDelete(id, userId),
            markSyncedCreate: (id, serverId, expectedUpdatedAt) =>
              conditionsRepo.markSyncedCreate(id, serverId, expectedUpdatedAt, userId),
            markSynced: (id, expectedUpdatedAt) =>
              conditionsRepo.markSynced(id, expectedUpdatedAt, userId),
          },
        ),
      row.local_uuid,
      (id) => conditionsRepo.hardDelete(id, userId),
    );
  }
}

async function pushDiagnoses(userId: string): Promise<void> {
  const medicalInformation = await medicalInformationRepo.getByUserId(userId);
  const medicalInformationId = medicalInformation?.server_id;
  if (!medicalInformationId) return;

  for (const row of await diagnosesRepo.getAllForPush(userId)) {
    assertCurrentPatientUser(userId);
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    await pushOne(
      "diagnosis",
      () =>
        pushRecord(
          row,
          diagnosesRepo.toPayload(row),
          {
            create: (id, payload) =>
              createDiagnosis(medicalInformationId, id, payload),
            update: updateDiagnosis,
            remove: deleteDiagnosis,
          },
          {
            hardDelete: (id) => diagnosesRepo.hardDelete(id, userId),
            markSyncedCreate: (id, serverId, expectedUpdatedAt) =>
              diagnosesRepo.markSyncedCreate(id, serverId, expectedUpdatedAt, userId),
            markSynced: (id, expectedUpdatedAt) =>
              diagnosesRepo.markSynced(id, expectedUpdatedAt, userId),
          },
        ),
      row.local_uuid,
      (id) => diagnosesRepo.hardDelete(id, userId),
    );
  }
}

async function pushMedications(userId: string): Promise<void> {
  for (const row of await medicationsRepo.getAllForPush(userId)) {
    assertCurrentPatientUser(userId);
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    await pushOne(
      "medication",
      () =>
        pushRecord(
          row,
          medicationsRepo.toPayload(row),
          {
            create: createMedication,
            update: updateMedication,
            remove: deleteMedication,
          },
          {
            hardDelete: (id) => medicationsRepo.hardDelete(id, userId),
            markSyncedCreate: (id, serverId, expectedUpdatedAt) =>
              medicationsRepo.markSyncedCreate(id, serverId, expectedUpdatedAt, userId),
            markSynced: (id, expectedUpdatedAt) =>
              medicationsRepo.markSynced(id, expectedUpdatedAt, userId),
          },
        ),
      row.local_uuid,
      (id) => medicationsRepo.hardDelete(id, userId),
    );
  }
}

async function pushEmergencyContacts(userId: string): Promise<void> {
  for (const row of await emergencyContactsRepo.getAllForPush(userId)) {
    assertCurrentPatientUser(userId);
    // react-doctor-disable-next-line react-doctor/async-await-in-loop
    await pushOne(
      "emergency contact",
      () =>
        pushRecord(
          row,
          emergencyContactsRepo.toPayload(row),
          {
            create: createEmergencyContact,
            update: updateEmergencyContact,
            remove: deleteEmergencyContact,
          },
          {
            hardDelete: (id) => emergencyContactsRepo.hardDelete(id, userId),
            markSyncedCreate: (id, serverId, expectedUpdatedAt) =>
              emergencyContactsRepo.markSyncedCreate(id, serverId, expectedUpdatedAt, userId),
            markSynced: (id, expectedUpdatedAt) =>
              emergencyContactsRepo.markSynced(id, expectedUpdatedAt, userId),
          },
        ),
      row.local_uuid,
      (id) => emergencyContactsRepo.hardDelete(id, userId),
    );
  }
}

async function pushMedicalInformation(userId: string): Promise<void> {
  const row = await medicalInformationRepo.getByUserId(userId);
  if (!row || row.sync_status !== "pending") return;

  try {
    const payload = medicalInformationRepo.toPayload(row);
    if (!row.server_id) {
      await createMedicalInformation(payload);
    } else {
      await updateMedicalInformation(row.server_id, payload);
    }
    assertCurrentPatientUser(userId);
    await medicalInformationRepo.markSynced(userId, row.updated_at_local);
  } catch (err) {
    if (err instanceof NetworkError || err instanceof UnauthenticatedError)
      throw err;
    console.warn(
      TAG,
      "failed to push medical information, will retry next cycle",
      { error: String(err) },
    );
  }
}

async function performPatientPush(userId: string): Promise<void> {
  assertCurrentPatientUser(userId);
  await pushMedicalInformation(userId);
  assertCurrentPatientUser(userId);
  await pushAllergies(userId);
  await pushConditions(userId);
  await pushDiagnoses(userId);
  await pushMedications(userId);
  await pushEmergencyContacts(userId);
  try {
    await pushEmergencyHistory(userId);
  } catch (error) {
    console.warn(TAG, "emergency history remains pending", {
      error: String(error),
    });
  }
  consecutiveFailures = 0;
}

function startPatientPush(userId: string): Promise<void> {
  if (activePush) return activePush.task;

  const task = performPatientPush(userId)
    .catch((err) => {
      if (err instanceof NetworkError || err instanceof UnauthenticatedError) {
        consecutiveFailures += 1;
        lastFailureAt = Date.now();
        console.warn(TAG, "push failed, will retry on next trigger", {
          error: String(err),
          consecutiveFailures,
        });
      } else {
        console.error(TAG, "unexpected error during push", {
          error: String(err),
        });
      }
      throw err;
    })
    .finally(() => {
      if (activePush?.task === task) activePush = null;
    });
  activePush = { userId, task };
  return task;
}

async function settlePatientPush(task: Promise<void>, throwOnError: boolean): Promise<void> {
  try {
    await task;
  } catch (error) {
    if (throwOnError) throw error;
  }
}

/** Pushes every locally-pending patient-authored change to the cloud API. Single-flight guarded. */
export async function pushPatientChanges(): Promise<void> {
  if (!getCachedToken() || !hasCurrentUser()) return;
  const userId = String(getCurrentUserId());

  if (activePush) {
    while (activePush) {
      await settlePatientPush(activePush.task, false);
      if (!getCachedToken() || !isCurrentPatientUser(userId)) return;
    }
    if (getIsOffline() || withinBackoffWindow()) return;
    const pendingMedical = await medicalInformationRepo.getByUserId(userId);
    if (pendingMedical?.sync_status !== "pending") return;
    return settlePatientPush(startPatientPush(userId), false);
  }
  if (getIsOffline() || withinBackoffWindow()) return;

  return settlePatientPush(startPatientPush(userId), false);
}

/**
 * Force-pushes all pending patient data before logout. Bypasses backoff and offline checks.
 * Existing work is drained first so account context cannot change beneath an in-flight push.
 */
export async function forcePushBeforeLogout(): Promise<void> {
  if (!getCachedToken() || !hasCurrentUser()) return;
  const userId = String(getCurrentUserId());

  console.log(TAG, "forcePushBeforeLogout: flushing all pending changes");
  try {
    while (activePush) {
      await settlePatientPush(activePush.task, false);
      if (!getCachedToken() || !isCurrentPatientUser(userId)) return;
    }
    await startPatientPush(userId);
    console.log(TAG, "forcePushBeforeLogout: done");
  } catch (err) {
    console.warn(TAG, "forcePushBeforeLogout: some data may not have synced", {
      error: String(err),
    });
  }
}

/**
 * Pulls everything changed server-side since the last successful pull and applies it locally.
 * Last-write-wins: whatever the server returns unconditionally overwrites the matching local row
 * (see each repo's `upsertFromServer`/`saveFromServer`) — this is where the losing side of a
 * same-record conflict finds out it lost. Single-flight guarded.
 */
type PullPatientChangesOptions = {
  /** Used only after the caller has independently confirmed connectivity. */
  force?: boolean;
  /** Authentication hydration and manual recovery must not report a false success. */
  throwOnError?: boolean;
};

function isCurrentPatientUser(userId: string): boolean {
  return hasCurrentUser() && String(getCurrentUserId()) === userId;
}

function assertCurrentPatientUser(userId: string): void {
  if (!isCurrentPatientUser(userId)) {
    throw new Error("Patient sync account changed while a pull was in progress");
  }
}

async function performPatientPull(userId: string): Promise<void> {
  assertCurrentPatientUser(userId);
  const since = await getLastSyncedAt(userId);
  assertCurrentPatientUser(userId);
  console.debug(TAG, `pull: fetching changes since ${since ?? "(ever)"}`);
  const response = await pullSync(since);
  assertCurrentPatientUser(userId);
  console.debug(TAG, `pull: received`, {
    allergies: response.allergies.length,
    conditions: response.conditions.length,
    diagnoses: response.diagnoses.length,
    medications: response.medications.length,
    emergency_contacts: response.emergency_contacts.length,
    medical_information: response.medical_information ? "present" : "null",
    unreadable_peer_records: response.unreadable_peer_records,
  });

  if (response.medical_information) {
    const localMedical = await medicalInformationRepo.getByUserId(userId);
    // A cloud snapshot must not erase an edit that has not reached the server yet.
    if (localMedical?.sync_status !== "pending") {
      await medicalInformationRepo.saveFromServer(response.medical_information, userId);
    }
  }

  await Promise.all(
    response.allergies.map((record) =>
      record.deleted_at
        ? allergiesRepo.hardDelete(record.id, userId)
        : allergiesRepo.upsertFromServer(record, userId),
    ),
  );

  await Promise.all(
    response.conditions.map((record) =>
      record.deleted_at
        ? conditionsRepo.hardDelete(record.id, userId)
        : conditionsRepo.upsertFromServer(record, userId),
    ),
  );

  await Promise.all(
    response.diagnoses.map((record) =>
      record.deleted_at
        ? (console.debug(TAG, `pull: deleting diagnosis ${record.id}`),
          diagnosesRepo.hardDelete(record.id, userId))
        : (console.debug(TAG, `pull: upserting diagnosis ${record.id}`, {
            condition: record.condition,
          }),
          diagnosesRepo.upsertFromServer(record, userId)),
    ),
  );

  await Promise.all(
    response.medications.map((record) =>
      record.deleted_at
        ? medicationsRepo.hardDelete(record.id, userId)
        : medicationsRepo.upsertFromServer(record, userId),
    ),
  );

  await Promise.all(
    response.emergency_contacts.map((record) =>
      record.deleted_at
        ? emergencyContactsRepo.hardDelete(record.id, userId)
        : emergencyContactsRepo.upsertFromServer(record, userId),
    ),
  );

  try {
    assertCurrentPatientUser(userId);
    await pullEmergencyHistoryIfDue(userId);
  } catch (error) {
    console.warn(TAG, "emergency history refresh deferred", {
      error: String(error),
    });
  }

  if (response.unreadable_peer_records === 0) {
    await setLastSyncedAt(userId, response.server_time);
  } else {
    // Keep the old cursor so damaged peer rows remain eligible for a later recovery pull.
    console.warn(TAG, "pull completed with unreadable peer records; sync cursor not advanced", {
      unreadablePeerRecords: response.unreadable_peer_records,
    });
  }
  consecutiveFailures = 0;

  if (isCurrentPatientUser(userId)) {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: medicalInformationQueryKey }),
      queryClient.invalidateQueries({ queryKey: allergiesQueryKey }),
      queryClient.invalidateQueries({ queryKey: conditionsQueryKey }),
      queryClient.invalidateQueries({ queryKey: diagnosesQueryKey }),
      queryClient.invalidateQueries({ queryKey: medicationsQueryKey }),
      queryClient.invalidateQueries({ queryKey: emergencyContactsQueryKey }),
    ]);
  }
}

function startPatientPull(userId: string): Promise<void> {
  if (activePull) return activePull.task;

  const task = performPatientPull(userId)
    .catch((err) => {
      if (err instanceof NetworkError || err instanceof UnauthenticatedError) {
        consecutiveFailures += 1;
        lastFailureAt = Date.now();
        console.warn(TAG, "pull failed, will retry on next trigger", {
          error: String(err),
          consecutiveFailures,
        });
      } else {
        console.error(TAG, "unexpected error during pull", {
          error: String(err),
        });
      }
      throw err;
    })
    .finally(() => {
      if (activePull?.task === task) activePull = null;
    });
  activePull = { userId, task };
  return task;
}

async function settlePatientPull(task: Promise<void>, throwOnError: boolean): Promise<void> {
  try {
    await task;
  } catch (error) {
    if (throwOnError) throw error;
  }
}

export async function pullPatientChanges(options: PullPatientChangesOptions = {}): Promise<void> {
  const strict = options.throwOnError ?? false;
  if (!getCachedToken() || !hasCurrentUser()) {
    if (strict) throw new Error("Patient hydration requires an authenticated user");
    return;
  }
  const userId = String(getCurrentUserId());
  while (activePull) {
    const running = activePull;
    if (running.userId === userId) return settlePatientPull(running.task, strict);
    // A completed pull for another account must never stand in for this user's hydration.
    await settlePatientPull(running.task, false);
    if (!getCachedToken() || !isCurrentPatientUser(userId)) {
      if (strict) throw new Error("Patient hydration account changed before the pull started");
      return;
    }
  }
  if (!options.force && (getIsOffline() || withinBackoffWindow())) return;

  return settlePatientPull(startPatientPull(userId), strict);
}

/**
 * Performs a guaranteed full cloud pull for login and explicit recovery. It waits for an older
 * in-flight delta pull, clears the cursor again, bypasses stale offline/backoff state, and rejects
 * if cloud decryption or local persistence fails.
 */
export async function hydratePatientChanges(): Promise<void> {
  if (!hasCurrentUser()) throw new Error("Patient hydration requires an authenticated user");
  const userId = String(getCurrentUserId());
  await pushPatientChanges();
  assertCurrentPatientUser(userId);

  // Recovery must never join an older delta pull that already captured a non-null cursor.
  // Drain any in-flight pull, clear again, then claim the single-flight slot synchronously.
  while (true) {
    if (activePull) await settlePatientPull(activePull.task, false);
    assertCurrentPatientUser(userId);
    await clearLastSyncedAt(userId);
    assertCurrentPatientUser(userId);
    if (activePull) continue;
    await settlePatientPull(startPatientPull(userId), true);
    return;
  }
}

/** Drains account-bound patient work before auth changes, without allowing auth to hang forever. */
export async function waitForPatientSyncIdle(timeoutMs = 5_000): Promise<void> {
  let stopped = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const drain = async () => {
    while (!stopped && (activePush || activePull)) {
      const tasks = [activePush?.task, activePull?.task]
        .filter((task): task is Promise<void> => Boolean(task));
      await Promise.all(tasks.map(async (task) => {
        try {
          await task;
        } catch {
          // Pending data remains queued for the next login.
        }
      }));
    }
  };

  try {
    await Promise.race([
      drain(),
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    stopped = true;
    if (timeout) clearTimeout(timeout);
  }
}

/** Pushes local edits first, then hydrates every patient-authored collection from the cloud. */
export async function syncPatientChanges(): Promise<void> {
  await pushPatientChanges();
  await pullPatientChanges();
}
