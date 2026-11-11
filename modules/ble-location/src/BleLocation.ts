import { Platform } from 'react-native';
import { requireNativeModule } from 'expo';

type BleLocationModule = {
  /** Checks system Location Services and, if disabled, shows the inline Play Services "Turn on Location" dialog. Resolves `true` once Location Services is confirmed on, `false` if the user declined or no resolution was possible. */
  ensureEnabled(): Promise<boolean>;
};

const fallback: BleLocationModule = {
  async ensureEnabled() {
    return true;
  },
};

export default Platform.OS === 'android'
  ? requireNativeModule<BleLocationModule>('BleLocation')
  : fallback;
