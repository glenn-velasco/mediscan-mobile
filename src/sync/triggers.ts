import { useEffect } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import { pullPendingSync } from '@/services/pending-sync.service';
import { retryPendingRevoke } from '@/services/device-key.service';
import { queryClient } from '@/lib/query-client';

const PERIODIC_INTERVAL_MS = 60_000;

let initialized = false;

/** Same NetInfo/AppState/interval trigger pattern the old mutation-queue processor used, now driving a pending-sync pull instead of an outbox drain. */
export function useSyncTriggers(): void {
  useEffect(() => {
    if (initialized) return;
    initialized = true;

    void pullPendingSync();
    void retryPendingRevoke();

    const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) void pullPendingSync();
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void pullPendingSync();
        void retryPendingRevoke();
        void queryClient.invalidateQueries();
      }
    });

    const interval = setInterval(() => void pullPendingSync(), PERIODIC_INTERVAL_MS);

    return () => {
      netInfoUnsubscribe();
      appStateSubscription.remove();
      clearInterval(interval);
      initialized = false;
    };
  }, []);
}
