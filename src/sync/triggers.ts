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
  const { refreshUser } = useAuth();

  useEffect(() => {
    if (initialized) return;
    initialized = true;

    void pullPendingSync();
    void refreshUser();
    void retryPendingRevoke();

    const netInfoUnsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        void pullPendingSync();
        void refreshUser();
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void pullPendingSync();
        void refreshUser();
        void retryPendingRevoke();
        void queryClient.invalidateQueries();
      }
    });

    const interval = setInterval(() => {
      void pullPendingSync();
      void refreshUser();
    }, PERIODIC_INTERVAL_MS);

    return () => {
      netInfoUnsubscribe();
      appStateSubscription.remove();
      clearInterval(interval);
      initialized = false;
    };
  }, []);
}
