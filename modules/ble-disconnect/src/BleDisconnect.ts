import { requireNativeModule } from 'expo';

type BleDisconnectModule = {
  /** Disconnects all bonded (paired) Bluetooth devices. Returns the number disconnected. */
  disconnectAll(): Promise<number>;
};

export default requireNativeModule<BleDisconnectModule>('BleDisconnect');
