import { Platform } from 'react-native';

import BleLocationNative from './BleLocation';

/** Android-only: confirms system Location Services is on, prompting via the inline system dialog if not. Always resolves `true` on other platforms. */
export async function ensureLocationEnabled(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  return BleLocationNative.ensureEnabled();
}
