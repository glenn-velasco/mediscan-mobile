import { requireNativeModule } from 'expo';

type BleRadioModule = {
  /** Checks the Bluetooth radio and, if off, shows the inline system "Turn on Bluetooth" dialog. Resolves `true` once Bluetooth is confirmed on, `false` if the user declined or no activity was available. */
  ensureEnabled(): Promise<boolean>;
};

export default requireNativeModule<BleRadioModule>('BleRadio');
