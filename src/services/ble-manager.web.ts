import type { BleManager } from 'react-native-ble-plx';

const noopSubscription = { remove: () => {} };

const webBleManagerStub = {
  state: async () => 'Unsupported',
  onStateChange: () => noopSubscription,
  startDeviceScan: () => {},
  stopDeviceScan: () => {},
  connectToDevice: async () => {
    throw new Error('BLE is not supported on web');
  },
  cancelDeviceConnection: async () => {},
  destroy: () => {},
} as unknown as BleManager;

export function getManager(): BleManager {
  return webBleManagerStub;
}

export function isBleSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

export async function ensureBluetoothEnabled(): Promise<boolean> {
  return isBleSupported();
}
