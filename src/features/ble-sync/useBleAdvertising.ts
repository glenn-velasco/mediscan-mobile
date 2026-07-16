import { useCallback, useEffect, useRef, useState } from 'react';

import * as blePeripheralService from '@/services/ble-peripheral.service';
import { useBlePeripheralPermission } from '@/hooks/use-ble-permission';
import { useAuth } from '@/auth/useAuth';

export type BleAdvertisingState = 'idle' | 'starting' | 'advertising' | 'error';

/** Patient-side hook: toggles Scenario 1 (both devices present) Bluetooth sync on/off. */
export function useBleAdvertising() {
  const { user } = useAuth();
  const [permission, requestPermission] = useBlePeripheralPermission();
  const [state, setState] = useState<BleAdvertisingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const userRef = useRef(user);
  userRef.current = user;

  const start = useCallback(async () => {
    if (!userRef.current) return;
    setState('starting');
    setError(null);
    try {
      const granted = permission?.granted ?? (await requestPermission());
      if (!granted) {
        setState('error');
        setError('Bluetooth permission was not granted.');
        return;
      }
      await blePeripheralService.startAdvertising(userRef.current.id);
      setState('advertising');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Failed to start Bluetooth sync.');
    }
  }, [permission, requestPermission]);

  const stop = useCallback(async () => {
    await blePeripheralService.stopAdvertising();
    setState('idle');
  }, []);

  // Sync state with module-level advertising flag on mount (survives remounts).
  useEffect(() => {
    if (blePeripheralService.isAdvertising()) {
      setState('advertising');
    }
  }, []);

  return { state, error, isAdvertising: state === 'advertising', start, stop };
}
