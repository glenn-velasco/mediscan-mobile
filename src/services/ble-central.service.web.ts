import type { Device } from 'react-native-ble-plx';

import { BLE_SERVICE_UUID, BLE_CHARACTERISTIC_UUIDS } from '@/lib/ble-gatt-constants';
import { chunkEnvelope } from '@/lib/ble-chunking';
import { encodeBleEnvelopePayload } from '@/lib/ble-envelope-wire';
import type { EnvelopeType } from '@/api/types';

type WebBluetoothCharacteristic = {
  readValue(): Promise<DataView>;
  writeValueWithResponse(value: BufferSource): Promise<void>;
  startNotifications(): Promise<WebBluetoothCharacteristic>;
  stopNotifications(): Promise<WebBluetoothCharacteristic>;
  addEventListener(type: 'characteristicvaluechanged', listener: (event: Event) => void): void;
  removeEventListener(type: 'characteristicvaluechanged', listener: (event: Event) => void): void;
  value?: DataView;
};

type WebBluetoothService = {
  getCharacteristic(uuid: string): Promise<WebBluetoothCharacteristic>;
};

type WebBluetoothGattServer = {
  connected: boolean;
  connect(): Promise<WebBluetoothGattServer>;
  disconnect(): void;
  getPrimaryService(uuid: string): Promise<WebBluetoothService>;
};

type WebBluetoothDevice = {
  id: string;
  name?: string;
  gatt?: WebBluetoothGattServer;
};

type NavigatorWithBluetooth = Navigator & {
  bluetooth?: {
    requestDevice(options: {
      filters: Array<{ services: string[] }>;
      optionalServices?: string[];
    }): Promise<WebBluetoothDevice>;
  };
};

export type DiscoveredPeer = {
  deviceId: string;
  publicKeyBase64: string;
  device: Device;
  webDevice?: WebBluetoothDevice;
};

export type SubmitResult = 'acked' | 'failed';

export async function scanForPatient(patientId: string | number): Promise<DiscoveredPeer | null> {
  const nav = typeof navigator !== 'undefined' ? (navigator as NavigatorWithBluetooth) : undefined;
  if (!nav?.bluetooth) return null;

  try {
    const webDevice = await nav.bluetooth.requestDevice({
      filters: [{ services: [BLE_SERVICE_UUID] }],
      optionalServices: [BLE_SERVICE_UUID],
    });
    if (!webDevice.gatt) return null;

    const server = await webDevice.gatt.connect();
    const service = await server.getPrimaryService(BLE_SERVICE_UUID);

    const patientIdChar = await service.getCharacteristic(BLE_CHARACTERISTIC_UUIDS.patientId);
    const patientIdView = await patientIdChar.readValue();
    const decodedPatientId = new TextDecoder().decode(patientIdView.buffer);

    if (decodedPatientId !== String(patientId)) {
      server.disconnect();
      return null;
    }

    const publicKeyChar = await service.getCharacteristic(BLE_CHARACTERISTIC_UUIDS.publicKey);
    const publicKeyView = await publicKeyChar.readValue();
    const publicKeyBase64 = new TextDecoder().decode(publicKeyView.buffer);
    if (!publicKeyBase64) {
      server.disconnect();
      return null;
    }

    return {
      deviceId: webDevice.id,
      publicKeyBase64,
      device: webDevice as unknown as Device,
      webDevice,
    };
  } catch {
    return null;
  }
}

export async function connectAndSubmit(
  peer: DiscoveredPeer,
  envelopeType: EnvelopeType,
  sealedCiphertextB64: string,
  ackTimeoutMs = 15000,
): Promise<SubmitResult> {
  const webDevice = peer.webDevice ?? (peer.device as unknown as WebBluetoothDevice);
  if (!webDevice?.gatt) return 'failed';

  const wirePayload = encodeBleEnvelopePayload(envelopeType, sealedCiphertextB64);
  const chunks = chunkEnvelope(wirePayload);
  const encoder = new TextEncoder();

  try {
    const server = webDevice.gatt.connected ? webDevice.gatt : await webDevice.gatt.connect();
    const service = await server.getPrimaryService(BLE_SERVICE_UUID);
    const ackChar = await service.getCharacteristic(BLE_CHARACTERISTIC_UUIDS.envelopeAck);
    const writeChar = await service.getCharacteristic(BLE_CHARACTERISTIC_UUIDS.envelopeWrite);

    await ackChar.startNotifications();

    const ackPromise = new Promise<SubmitResult>((resolve) => {
      const timer = setTimeout(() => {
        ackChar.removeEventListener('characteristicvaluechanged', onAck);
        resolve('failed');
      }, ackTimeoutMs);

      function onAck(event: Event) {
        const target = event.target as WebBluetoothCharacteristic | null;
        if (!target?.value) return;
        clearTimeout(timer);
        ackChar.removeEventListener('characteristicvaluechanged', onAck);
        const ackValue = new TextDecoder().decode(target.value.buffer);
        resolve(ackValue === 'merged' ? 'acked' : 'failed');
      }

      ackChar.addEventListener('characteristicvaluechanged', onAck);
    });

    for (let i = 0; i < chunks.length; i++) {
      await writeChar.writeValueWithResponse(encoder.encode(chunks[i]));
      if (i < chunks.length - 1) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    return await ackPromise;
  } catch {
    return 'failed';
  } finally {
    try {
      webDevice.gatt.disconnect();
    } catch {
      // Ignore disconnect errors
    }
  }
}
