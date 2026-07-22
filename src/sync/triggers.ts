import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { useAuth } from '@/auth/useAuth';
import { pullPendingSync } from '@/services/pending-sync.service';
import { pushPatientChanges, pullPatientChanges } from '@/services/patient-sync.service';
import { retryPendingRevoke } from '@/services/device-key.service';
import { queryClient } from '@/lib/query-client';

const PERIODIC_INTERVAL_MS = 60_000;

let initialized = false;

/**
 * Push before pull so a change made on this device isn't immediately clobbered by a pull that
 * hasn't seen it yet — the two are independent single-flight operations (see
 * patient-sync.service.ts), so running push first just means the pull cycle right after has the
 * best chance of reflecting this device's own latest state, not a hard ordering guarantee.
 */
async function syncPatientData(): Promise<void> {
  await pushPatientChanges();
  await pullPatientChanges();
}

/**
 * Same NetInfo/AppState/interval trigger pattern the old mutation-queue processor used - now
 * drives both the pending-sync (BLE/envelope/professional-attestation) pull *and*, separately, the
 * patient-authored CRUD push/pull (see patient-sync.service.ts and the backend repo's docs/SYNC.md
 * for why these are two independent sync systems, not one).
 */
export function useSyncTriggers(): void {
  const { status, refreshUser } = useAuth();

  useEffect(() => {
    if (initialized) return;
    initialized = true;

    const safeRefreshUser = () => {
      if (status !== 'authenticated') return;
      refreshUser().catch(() => {
        // Best-effort: likely offline or the token just expired; next trigger will retry.
      });
    };

    void pullPendingSync();
    void syncPatientData();
    safeRefreshUser();
    void retryPendingRevoke();

    const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        void pullPendingSync();
        void syncPatientData();
        safeRefreshUser();
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void pullPendingSync();
        void syncPatientData();
        safeRefreshUser();
        void retryPendingRevoke();
        void queryClient.invalidateQueries();
      }
    });

    const interval = setInterval(() => {
      void pullPendingSync();
      void syncPatientData();
      safeRefreshUser();
    }, PERIODIC_INTERVAL_MS);

    return () => {
      netInfoUnsubscribe();
      appStateSubscription.remove();
      clearInterval(interval);
      initialized = false;
    };
  }, [status, refreshUser]);
}
