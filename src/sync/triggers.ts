import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { useAuth } from '@/auth/useAuth';
import { pullPendingSync } from '@/services/pending-sync.service';
import { retryPendingRevoke } from '@/services/device-key.service';
import { queryClient } from '@/lib/query-client';

const PERIODIC_INTERVAL_MS = 60_000;

let initialized = false;

/** Same NetInfo/AppState/interval trigger pattern the old mutation-queue processor used, now driving a pending-sync pull instead of an outbox drain. */
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
    safeRefreshUser();
    void retryPendingRevoke();

    const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        void pullPendingSync();
        safeRefreshUser();
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void pullPendingSync();
        safeRefreshUser();
        void retryPendingRevoke();
        void queryClient.invalidateQueries();
      }
    });

    const interval = setInterval(() => {
      void pullPendingSync();
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
