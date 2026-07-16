import { NativeModule, requireNativeModule } from 'expo';

import type { BlePeripheralModuleEvents } from './BlePeripheral.types';

declare class BlePeripheralModule extends NativeModule<BlePeripheralModuleEvents> {
  /** Starts advertising the fixed GATT service and sets the read-only patient_id/public_key characteristic values. Resolves once advertising has started; rejects if Bluetooth is unavailable/unauthorized. */
  startAdvertising(patientId: string, publicKeyBase64: string): Promise<void>;
  /** Stops advertising and tears down the GATT server. Safe to call when not advertising. */
  stopAdvertising(): Promise<void>;
  /** Writes `payload` to the envelope_ack characteristic and notifies the connected central. */
  sendAck(payload: string): Promise<void>;
}

export default requireNativeModule<BlePeripheralModule>('BlePeripheral');
