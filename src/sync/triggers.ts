import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { useAuth } from '@/auth/useAuth';
import { pullPendingSync } from '@/services/pending-sync.service';
import { pushPatientChanges, pullPatientChanges } from '@/services/patient-sync.service';
import { retryPendingRevoke } from '@/services/device-key.service';
import { queryClient } from '@/lib/query-client';

const PERIODIC_INTERVAL_MS = 60_000;

/**
 * Foreground, NetInfo reconnect, and the periodic interval can all fire in quick succession
 * (e.g. NetInfo re-reporting "connected" a few times as the OS settles, right as the app comes to
 * the foreground) — without a shared cooldown each one kicks off its own full push+pull cycle,
 * and retries of already-failing items pile on top, which is enough to trip the backend's
 * `sync`/`api` rate limits (429 Too Many Attempts) during normal use, not just abuse.
 */
const MIN_TRIGGER_INTERVAL_MS = 10_000;
let lastTriggerAt = 0;

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

    /** Shared cooldown across all trigger sources — see MIN_TRIGGER_INTERVAL_MS above. */
    const runTriggeredSync = (extras?: { retryRevoke?: boolean; invalidateQueries?: boolean }) => {
      const now = Date.now();
      if (now - lastTriggerAt < MIN_TRIGGER_INTERVAL_MS) return;
      lastTriggerAt = now;

      void pullPendingSync();
      void syncPatientData();
      safeRefreshUser();
      if (extras?.retryRevoke) void retryPendingRevoke();
      if (extras?.invalidateQueries) void queryClient.invalidateQueries();
    };

    runTriggeredSync({ retryRevoke: true });

    const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) runTriggeredSync();
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') runTriggeredSync({ retryRevoke: true, invalidateQueries: true });
    });

    const interval = setInterval(() => {
      runTriggeredSync();
    }, PERIODIC_INTERVAL_MS);

    return () => {
      netInfoUnsubscribe();
      appStateSubscription.remove();
      clearInterval(interval);
      initialized = false;
    };
  }, [status, refreshUser]);
}
