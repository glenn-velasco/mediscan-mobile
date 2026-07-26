import { requireNativeModule } from 'expo';

type BleLocationModule = {
  /** Checks system Location Services and, if disabled, shows the inline Play Services "Turn on Location" dialog. Resolves `true` once Location Services is confirmed on, `false` if the user declined or no resolution was possible. */
  ensureEnabled(): Promise<boolean>;
};

export default requireNativeModule<BleLocationModule>('BleLocation');
