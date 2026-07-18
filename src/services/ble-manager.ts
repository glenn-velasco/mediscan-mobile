import { Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';

import BleRadioNative from '../../modules/ble-radio/src/BleRadio';

let manager: BleManager | null = null;

export function getManager(): BleManager {
  if (!manager) manager = new BleManager();
  return manager;
}

/**
 * Android-only: ensures the Bluetooth radio is on, prompting via the inline system dialog if not.
 * `react-native-ble-plx`'s own `BleManager.enable()` never actually shows this dialog on Android
 * 12+ (its native module only holds an application Context, not an Activity), so this goes through
 * a small dedicated native module (`modules/ble-radio`) instead. Always resolves `true` on other
 * platforms.
 */
export async function ensureBluetoothEnabled(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  return BleRadioNative.ensureEnabled();
}
