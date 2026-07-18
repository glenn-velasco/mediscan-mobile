import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import * as blePeripheralService from '@/services/ble-peripheral.service';
import { useBlePeripheralPermission } from '@/hooks/use-ble-permission';
import { useAuth } from '@/auth/useAuth';
import { ensureBluetoothEnabled } from '@/services/ble-manager';
import { ensureLocationEnabled } from '../../../modules/ble-location/src/ensureLocationEnabled';
import { getSnapshot as getToggleSnapshot, setEnabled as persistEnabled, subscribe as subscribeToggle } from '@/features/ble-sync/ble-advertising-toggle.store';

export type BleAdvertisingState = 'idle' | 'starting' | 'advertising' | 'error';

/** Patient-side hook: toggles Scenario 1 (both devices present) Bluetooth sync on/off. */
export function useBleAdvertising() {
  const { user } = useAuth();
  const [permission, requestPermission] = useBlePeripheralPermission();
  const [state, setState] = useState<BleAdvertisingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const userRef = useRef(user);
  userRef.current = user;
  const toggle = useSyncExternalStore(subscribeToggle, getToggleSnapshot);

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
  }, [permission, requestPermission]);

  const stop = useCallback(async () => {
    await blePeripheralService.stopAdvertising();
    setState('idle');
    void persistEnabled(false);
  }, []);

  // Sync state with module-level advertising flag on mount (survives remounts). If sync was
  // already on, make sure the Bluetooth radio is actually enabled too — it may have been turned
  // off outside the app since. Leaves everything untouched when sync is off.
  useEffect(() => {
    if (!blePeripheralService.isAdvertising()) return;
    setState('advertising');
    void ensureBluetoothEnabled();
  }, []);

  // Cold start: the peripheral service's in-memory flag is always false on a fresh launch, so
  // re-derive "should be advertising" from the persisted preference instead and resume it —
  // otherwise the user has to flip the switch back on every time the app reloads.
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current) return;
    if (!toggle.loaded || !toggle.enabled) return;
    if (!user) return;
    if (blePeripheralService.isAdvertising()) return;
    resumedRef.current = true;
    void start();
  }, [toggle.loaded, toggle.enabled, user, start]);

  return { state, error, isAdvertising: state === 'advertising', start, stop };
}
