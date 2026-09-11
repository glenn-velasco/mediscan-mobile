import { useCallback } from 'react';
import { Platform } from 'react-native';

import BleDisconnect from '../../../modules/ble-disconnect/src/BleDisconnect';

export function useDisconnectBondedDevices() {
  const disconnectIfAndroid = useCallback(async (): Promise<void> => {
    if (Platform.OS !== 'android') return;
    try {
      await BleDisconnect.disconnectAll();
    } catch {
      // Ignore — scan will fall back to relay
    }
  }, []);

  return { disconnectIfAndroid };
}
