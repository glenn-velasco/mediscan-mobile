import { Platform } from 'react-native';
import { requireNativeModule } from 'expo';

type BleDisconnectModule = {
  /** Disconnects all bonded (paired) Bluetooth devices. Returns the number disconnected. */
  disconnectAll(): Promise<number>;
};

const fallback: BleDisconnectModule = {
  async disconnectAll() {
    return 0;
  },
};

export default Platform.OS === 'android'
  ? requireNativeModule<BleDisconnectModule>('BleDisconnect')
  : fallback;
