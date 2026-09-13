import { useEffect, useRef } from 'react';

import { useAuth } from '@/auth/useAuth';
import { useBlePeripheralPermission } from '@/hooks/use-ble-permission';
import * as blePeripheralService from '@/services/ble-peripheral.service';
import { ensureBluetoothEnabled } from '@/services/ble-manager';
import { ensureLocationEnabled } from '../../../modules/ble-location/src/ensureLocationEnabled';

/**
 * Global hook that auto-starts BLE advertising when the user is authenticated.
 * Mount once at the app root (inside AuthProvider) so advertising starts regardless of
 * which screen the user opens. Advertising stops on logout.
 */
export function useBleAdvertisingResume() {
  const { user } = useAuth();
  const [permission, requestPermission] = useBlePeripheralPermission();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      startedRef.current = false;
      return;
    }
    if (startedRef.current) return;
    if (blePeripheralService.isAdvertising()) {
      startedRef.current = true;
      return;
    }
    startedRef.current = true;

    const schedule = (globalThis as unknown as { requestIdleCallback?: (callback: () => void) => number }).requestIdleCallback;
    const cancelIdle = (globalThis as unknown as { cancelIdleCallback?: (handle: number) => void }).cancelIdleCallback;
    const handle = schedule ? schedule(() => {
      void (async () => {
        try {
          const granted = permission?.granted || (await requestPermission());
          if (!granted) return;
          const bluetoothEnabled = await ensureBluetoothEnabled();
          if (!bluetoothEnabled) return;
          const locationEnabled = await ensureLocationEnabled();
          if (!locationEnabled) return;
          await blePeripheralService.startAdvertising(user.id);
        } catch {
          // Silent fail — BLE advertising will not be available but the app still works.
        }
      })();
    }) : setTimeout(() => {
      void (async () => {
        try {
          const granted = permission?.granted || (await requestPermission());
          if (!granted) return;
          const bluetoothEnabled = await ensureBluetoothEnabled();
          if (!bluetoothEnabled) return;
          const locationEnabled = await ensureLocationEnabled();
          if (!locationEnabled) return;
          await blePeripheralService.startAdvertising(user.id);
        } catch { /* BLE remains optional. */ }
      })();
    }, 0);
    return () => schedule ? cancelIdle?.(handle as number) : clearTimeout(handle as ReturnType<typeof setTimeout>);
  }, [user, permission, requestPermission]);
}
