import * as Crypto from 'expo-crypto';

import * as pendingVerificationSyncRepo from '@/db/repositories/pending-verification-sync.repo';
import { getPatientVerifications } from '@/api/endpoints/professional-sync';
import { NetworkError } from '@/api/errors';
import { getIsOffline } from '@/lib/network-state';

let isSyncing = false;

/**
 * Process pending verification syncs when online.
 * Called on app foreground, network reconnect, and after submitting envelopes.
 */
export async function syncPendingVerifications(): Promise<void> {
  if (getIsOffline()) return;
  if (isSyncing) return;
  isSyncing = true;

  try {
    const pending = await pendingVerificationSyncRepo.getUnsynced();

    const { trackVerification } = await import('@/api/endpoints/professional-sync');
    for (const item of pending) {
      try {
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        await trackVerification(item.patient_id, {
          envelope_type: item.envelope_type,
          item_identifier: item.item_identifier,
          verified: item.verified,
        });
        await pendingVerificationSyncRepo.markSynced(item.local_id);
      } catch (err) {
        if (err instanceof NetworkError) {
          // Will retry on next sync trigger
          break;
        }
        // Other errors: log but continue with other items
        console.warn('[VerificationSync] Failed to sync verification:', err);
      }
    }
  } finally {
    isSyncing = false;
  }
}

/**
 * Force-syncs all pending verification toggles before logout. Bypasses single-flight guard and
 * offline check — last-ditch attempt to save data before auth is cleared.
 */
export async function forceSyncBeforeLogout(): Promise<void> {
  console.log('[VerificationSync] forceSyncBeforeLogout: flushing pending verifications');
  try {
    const pending = await pendingVerificationSyncRepo.getUnsynced();
    if (pending.length === 0) return;

    const { trackVerification } = await import('@/api/endpoints/professional-sync');
    for (const item of pending) {
      try {
        // react-doctor-disable-next-line react-doctor/async-await-in-loop
        await trackVerification(item.patient_id, {
          envelope_type: item.envelope_type,
          item_identifier: item.item_identifier,
          verified: item.verified,
        });
        await pendingVerificationSyncRepo.markSynced(item.local_id);
      } catch {
        // Best-effort: skip items that fail
      }
    }
    console.log('[VerificationSync] forceSyncBeforeLogout: done');
  } catch (err) {
    console.warn('[VerificationSync] forceSyncBeforeLogout: some verifications may not have synced', { error: String(err) });
  }
}

/**
 * Queue verification for later sync (works offline).
 * Stores locally and triggers background sync if online.
 */
async function queueVerificationSync(params: {
  patientId: string | number;
  envelopeType: string;
  itemIdentifier: string;
  verified: boolean;
}): Promise<void> {
  await pendingVerificationSyncRepo.insert({
    localId: Crypto.randomUUID(),
    ...params,
  });

  // Trigger background sync (non-blocking)
  syncPendingVerifications().catch(() => {});
}

/**
 * Get effective verification status for a patient.
 * Merges server data with local pending syncs.
 * Last write wins: local pending overrides server for immediate feedback.
 */
export async function getEffectiveVerifications(
  patientId: string | number,
): Promise<{
  allergies: Map<string, boolean>;
  conditions: Map<string, boolean>;
  diagnoses: Map<string, boolean>;
  medications: Map<string, boolean>;
}> {
  const result = {
    allergies: new Map<string, boolean>(),
    conditions: new Map<string, boolean>(),
    diagnoses: new Map<string, boolean>(),
    medications: new Map<string, boolean>(),
  };

  if (!getIsOffline()) {
    try {
      const serverData = await getPatientVerifications(patientId);
      serverData.allergies?.forEach(v => result.allergies.set(v.item.toLowerCase(), v.verified));
      serverData.conditions?.forEach(v => result.conditions.set(v.item.toLowerCase(), v.verified));
      serverData.diagnoses?.forEach(v => result.diagnoses.set(v.item.toLowerCase(), v.verified));
      serverData.medications?.forEach(v => result.medications.set(v.item.toLowerCase(), v.verified));
    } catch {
      // Offline - continue with local data
    }
  }

  // Merge local pending (overrides server - last write wins)
  const localPending = await pendingVerificationSyncRepo.getForPatient(patientId);

  const typeToMap: Record<string, Map<string, boolean>> = {
    allergy_verification: result.allergies,
    condition_verification: result.conditions,
    diagnosis_verification: result.diagnoses,
    medication_verification: result.medications,
  };

  for (const item of localPending) {
    const map = typeToMap[item.envelope_type];
    if (map) {
      map.set(item.item_identifier.toLowerCase(), item.verified);
    }
  }

  return result;
}

/**
 * Get effective verification sets for initialization.
 * Returns Sets of item identifiers that are verified.
 */
export async function getEffectiveVerificationSets(
  patientId: string | number,
): Promise<{
  verifiedAllergens: Set<string>;
  verifiedConditions: Set<string>;
  verifiedDiagnoses: Set<string>;
  verifiedMedications: Set<string>;
}> {
  const verifications = await getEffectiveVerifications(patientId);

  const toVerifiedSet = (map: Map<string, boolean>) =>
    [...map.entries()].reduce<Set<string>>((acc, [k, v]) => (v ? acc.add(k) : acc), new Set());

  return {
    verifiedAllergens: toVerifiedSet(verifications.allergies),
    verifiedConditions: toVerifiedSet(verifications.conditions),
    verifiedDiagnoses: toVerifiedSet(verifications.diagnoses),
    verifiedMedications: toVerifiedSet(verifications.medications),
  };
}
