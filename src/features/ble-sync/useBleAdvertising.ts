import { useCallback, useEffect, useRef, useState } from 'react';

import * as blePeripheralService from '@/services/ble-peripheral.service';
import { useBlePeripheralPermission } from '@/hooks/use-ble-permission';
import { useAuth } from '@/auth/useAuth';
import { ensureBluetoothEnabled } from '@/services/ble-manager';
import { ensureLocationEnabled } from '../../../modules/ble-location/src/ensureLocationEnabled';
import { useBleAdvertisingToggleStore } from '@/features/ble-sync/ble-advertising-toggle.store';

export type BleAdvertisingState = 'idle' | 'starting' | 'advertising' | 'error';

/** Patient-side hook: toggles Scenario 1 (both devices present) Bluetooth sync on/off. */
export function useBleAdvertising() {
  const { user } = useAuth();
  const [permission, requestPermission] = useBlePeripheralPermission();
  // Initialize to 'advertising' if already advertising, otherwise 'idle'
  const [state, setState] = useState<BleAdvertisingState>(() =>
    blePeripheralService.isAdvertising() ? 'advertising' : 'idle',
  );
  const [error, setError] = useState<string | null>(null);
  const userRef = useRef(user);
  const persistEnabled = useBleAdvertisingToggleStore((s) => s.setEnabled);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const start = useCallback(async () => {
    if (!userRef.current) return;
    setState('starting');
    setError(null);
    try {
      const granted = permission?.granted || (await requestPermission());
      if (!granted) {
        setState('error');
        setError('Bluetooth permission was not granted.');
        void persistEnabled(false);
        return;
      }
      const bluetoothEnabled = await ensureBluetoothEnabled();
      if (!bluetoothEnabled) {
        setState('error');
        setError('Please turn on Bluetooth to sync with the professional.');
        void persistEnabled(false);
        return;
      }

      const locationEnabled = await ensureLocationEnabled();
      if (!locationEnabled) {
        setState('error');
        setError('Please turn on Location Services to sync via Bluetooth.');
        void persistEnabled(false);
        return;
      }
      await blePeripheralService.startAdvertising(userRef.current.id);
      setState('advertising');
      void persistEnabled(true);
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'Failed to start Bluetooth sync.');
      void persistEnabled(false);
    }
  }, [permission, requestPermission, persistEnabled]);

  const stop = useCallback(async () => {
    await blePeripheralService.stopAdvertising();
    setState('idle');
    void persistEnabled(false);
  }, [persistEnabled]);

  // Sync state with module-level advertising flag on mount (survives remounts). If sync was
  // already on, make sure the Bluetooth radio is actually enabled too — it may have been turned
  // off outside the app since. Leaves everything untouched when sync is off.
  useEffect(() => {
    if (!blePeripheralService.isAdvertising()) return;
    // Verify Bluetooth is still enabled; if not, stop advertising silently.
    ensureBluetoothEnabled().then((enabled) => {
      if (!enabled) void blePeripheralService.stopAdvertising();
    });
  }, []);

  return { state, error, isAdvertising: state === 'advertising', start, stop };
}
