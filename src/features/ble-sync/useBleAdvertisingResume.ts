import { useEffect, useRef } from 'react';

import { useAuth } from '@/auth/useAuth';
import { useBlePeripheralPermission } from '@/hooks/use-ble-permission';
import { useBleAdvertisingToggleStore } from '@/features/ble-sync/ble-advertising-toggle.store';
import * as blePeripheralService from '@/services/ble-peripheral.service';
import { ensureBluetoothEnabled } from '@/services/ble-manager';
import { ensureLocationEnabled } from '../../../modules/ble-location/src/ensureLocationEnabled';

/**
 * Global hook that resumes BLE advertising on cold start if the user previously enabled it.
 * Mount once at the app root (inside AuthProvider) so advertising resumes regardless of
 * which screen the user opens.
 */
export function useBleAdvertisingResume() {
  const { user } = useAuth();
  const [permission, requestPermission] = useBlePeripheralPermission();
  const toggle = useBleAdvertisingToggleStore();
  const resumedRef = useRef(false);

  useEffect(() => {
    if (resumedRef.current) return;
    if (!toggle.loaded || !toggle.enabled) return;
    if (!user) return;
    if (blePeripheralService.isAdvertising()) return;
    resumedRef.current = true;

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
        // Silently fail — the Account page toggle will show the error state if the user visits it.
      }
    })();
  }, [toggle.loaded, toggle.enabled, user, permission, requestPermission]);
}
