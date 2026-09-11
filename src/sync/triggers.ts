import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { getIsOffline } from '@/lib/network-state';
import { useAuth } from '@/auth/useAuth';
import { queryClient } from '@/lib/query-client';
import { ensureDeviceKeyServerRegistered, retryPendingRevoke } from '@/services/device-key.service';
import { pullPatientChanges, pushPatientChanges } from '@/services/patient-sync.service';
import { pullScannedPatients } from '@/services/scanned-patients-sync.service';
import { pullMyScanActivity } from '@/services/my-scan-activity-sync.service';

/**
 * Foreground and NetInfo reconnect can fire in quick succession
 * (e.g. NetInfo re-reporting "connected" a few times as the OS settles, right as the app comes to
 * the foreground) — without a shared cooldown each one kicks off its own full push+pull cycle,
 * and retries of already-failing items pile on top, which is enough to trip the backend's
 * `sync`/`api` rate limits (429 Too Many Attempts) during normal use, not just abuse.
 */
const MIN_TRIGGER_INTERVAL_MS = 10_000;

/**
 * Push before pull so a change made on this device isn't immediately clobbered by a pull that
 * hasn't seen it yet — the two are independent single-flight operations (see
 * patient-sync.service.ts), so running push first just means the pull cycle right after has the
 * best chance of reflecting this device's own latest state, not a hard ordering guarantee.
 */
async function syncPatientData(): Promise<void> {
  await pushPatientChanges();
  await pullPatientChanges();
  await pullScannedPatients();
  await pullMyScanActivity();
}

/**
 * Event-driven NetInfo/AppState trigger pattern - now
 * drives both the pending-sync (BLE/envelope/professional-attestation) pull *and*, separately, the
 * patient-authored CRUD push/pull (see patient-sync.service.ts and the backend repo's docs/SYNC.md
 * for why these are two independent sync systems, not one).
 */
export function useSyncTriggers(): void {
  const { status, refreshUser } = useAuth();
  const initializedRef = useRef(false);
  const lastTriggerAtRef = useRef(0);
  const mountedRef = useRef(true);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // react-doctor-disable-next-line react-doctor/effect-needs-cleanup
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    mountedRef.current = true;

    const scheduleTimer = (fn: () => void, delay: number) => {
      const id = setTimeout(() => {
        timersRef.current = timersRef.current.filter((t) => t !== id);
        fn();
      }, delay);
      timersRef.current.push(id);
    };

    const safeRefreshUser = () => {
      if (status !== 'authenticated' || !mountedRef.current) return;
      refreshUser().catch(() => {
        // Best-effort: likely offline or the token just expired; next trigger will retry.
      });
    };

    /** Shared cooldown across all trigger sources — see MIN_TRIGGER_INTERVAL_MS above. */
    const runTriggeredSync = (extras?: { retryRevoke?: boolean; invalidateQueries?: boolean; registerDeviceKey?: boolean }) => {
      if (!mountedRef.current) return;
      if (getIsOffline()) return;
      const now = Date.now();
      if (now - lastTriggerAtRef.current < MIN_TRIGGER_INTERVAL_MS) return;
      lastTriggerAtRef.current = now;

      scheduleTimer(() => {
        if (mountedRef.current) void syncPatientData();
      }, 500);
      safeRefreshUser();
      if (extras?.retryRevoke) void retryPendingRevoke();
      if (extras?.registerDeviceKey) void ensureDeviceKeyServerRegistered();
      if (extras?.invalidateQueries) {
        scheduleTimer(() => {
          if (mountedRef.current) void queryClient.invalidateQueries();
        }, 1000);
      }
    };

    runTriggeredSync({ retryRevoke: true, registerDeviceKey: true });

    const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      const reachable = state.isInternetReachable ?? state.isConnected;
      if (reachable && mountedRef.current) runTriggeredSync();
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && mountedRef.current) {
        runTriggeredSync({ retryRevoke: true, invalidateQueries: true, registerDeviceKey: true });
      }
    });

    return () => {
      mountedRef.current = false;
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
      netInfoUnsubscribe();
      appStateSubscription.remove();
      initializedRef.current = false;
    };
  }, [status, refreshUser]);
}
