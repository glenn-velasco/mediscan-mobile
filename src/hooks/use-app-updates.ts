import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { AppState } from 'react-native';

export function useAppUpdates() {
  const { isUpdatePending, isDownloading, downloadError } = Updates.useUpdates();

  useEffect(() => {
    console.log(`[updates] running updateId=${Updates.updateId ?? 'embedded'} channel=${Updates.channel ?? 'none'}`);
  }, []);

  useEffect(() => {
    if (!isUpdatePending) {
      return;
    }

    console.log('[updates] update downloaded and pending, will apply on next foreground');

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        console.log('[updates] app foregrounded with pending update, reloading now');
        void Updates.reloadAsync();
      }
    });

    return () => subscription.remove();
  }, [isUpdatePending]);

  return {
    isUpdatePending,
    isDownloading,
    downloadError,
  };
}
