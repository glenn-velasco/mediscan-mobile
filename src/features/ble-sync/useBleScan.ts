import { useCallback, useState } from 'react';

import * as bleCentralService from '@/services/ble-central.service';
import { useBleCentralPermission } from '@/hooks/use-ble-permission';
import type { DiscoveredPeer } from '@/services/ble-central.service';
import { ensureBluetoothEnabled } from '@/services/ble-manager';
import { ensureLocationEnabled } from '../../../modules/ble-location/src/ensureLocationEnabled';

export type BleScanState = 'idle' | 'scanning' | 'found' | 'timeout' | 'error';

/** Professional-side hook: scans for a QR-identified patient device advertising the fixed GATT service. */
export function useBleScan() {
  const [permission, requestPermission] = useBleCentralPermission();
  const [state, setState] = useState<BleScanState>('idle');
  const [peer, setPeer] = useState<DiscoveredPeer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(
    async (patientId: number, timeoutMs = 15000): Promise<DiscoveredPeer | null> => {
      setState('scanning');
      setError(null);
      setPeer(null);
      try {
        const granted = permission?.granted || (await requestPermission());
        if (!granted) {
          setState('error');
          setError('Bluetooth permission was not granted.');
          return null;
        }

        const bluetoothEnabled = await ensureBluetoothEnabled();
        if (!bluetoothEnabled) {
          setState('error');
          setError('Please turn on Bluetooth to scan for nearby devices.');
          return null;
        }

        const locationEnabled = await ensureLocationEnabled();
        if (!locationEnabled) {
          setState('error');
          setError('Please turn on Location Services to scan for nearby devices.');
          return null;
        }

        const found = await bleCentralService.scanForPatient(patientId, timeoutMs);
        if (!found) {
          setState('timeout');
          setError('Make sure the patient has Bluetooth sync open and both devices have Bluetooth enabled.');
          return null;
        }

        setPeer(found);
        setState('found');
        return found;
      } catch (err) {
        setState('error');
        setError(err instanceof Error ? err.message : 'Bluetooth scan failed.');
        return null;
      }
    },
    [permission, requestPermission],
  );

  const reset = useCallback(() => {
    setState('idle');
    setPeer(null);
    setError(null);
  }, []);

  return { state, peer, error, scan, reset };
}
