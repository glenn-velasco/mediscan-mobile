import type { Device } from 'react-native-ble-plx';

import { BLE_SERVICE_UUID, BLE_CHARACTERISTIC_UUIDS } from '@/lib/ble-gatt-constants';
import { chunkEnvelope } from '@/lib/ble-chunking';
import { encodeBleEnvelopePayload } from '@/lib/ble-envelope-wire';
import { base64ToUtf8, utf8ToBase64 } from '@/lib/base64';
import { getManager } from '@/services/ble-manager';
import type { EnvelopeType } from '@/api/types';

const TAG = '[BleCentralService]';

export type DiscoveredPeer = {
  deviceId: string;
  publicKeyBase64: string;
  device: Device;
};

export type SubmitResult = 'acked' | 'failed';

/**
 * Scans for a patient device advertising the fixed GATT service. The advertisement packet only
 * carries the service UUID (see ble-peripheral.service.ts), not the patient's identity, so each
 * candidate is connected to, its patient_id characteristic is read and checked against the
 * QR-scanned patientId before being accepted — the connection stays alive and is re-used by
 * connectAndSubmit. Resolves null on timeout.
 */
export async function scanForPatient(patientId: number, timeoutMs = 15000): Promise<DiscoveredPeer | null> {
  const bleManager = getManager();
  const expected = String(patientId);
  const attempted = new Set<string>();

  return new Promise<DiscoveredPeer | null>((resolve, reject) => {
    let settled = false;

    const finish = (result: DiscoveredPeer | null, error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      bleManager.stopDeviceScan();
      if (error) reject(error);
      else resolve(result);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    bleManager.startDeviceScan([BLE_SERVICE_UUID], null, (error, device) => {
      if (error) {
        finish(null, error);
        return;
      }
      if (settled || !device || attempted.has(device.id)) return;
      attempted.add(device.id);

      console.log(TAG, 'discovered candidate', {
        deviceId: device.id,
        name: device.name,
        localName: device.localName,
        rssi: device.rssi,
        manufacturerData: device.manufacturerData,
        serviceUUIDs: device.serviceUUIDs,
        serviceData: device.serviceData,
      });

      matchDevice(device, expected)
        .then((peer) => {
          if (peer) finish(peer);
        })
        .catch((err) => {
          console.warn(TAG, 'candidate device failed identity check', {
            deviceId: device.id,
            name: device.name,
            rssi: device.rssi,
            error: String(err),
          });
        });
    });
  });
}

async function matchDevice(device: Device, expectedPatientId: string): Promise<DiscoveredPeer | null> {
  console.log(TAG, 'connecting to candidate', { deviceId: device.id, name: device.name, rssi: device.rssi });
  const connected = await device.connect();
  console.log(TAG, 'connected to device', { deviceId: connected.id, mtu: connected.mtu });
  try {
    await connected.discoverAllServicesAndCharacteristics();
    console.log(TAG, 'services discovered', { deviceId: connected.id });

    const patientIdChar = await connected.readCharacteristicForService(BLE_SERVICE_UUID, BLE_CHARACTERISTIC_UUIDS.patientId);
    const patientId = patientIdChar.value ? base64ToUtf8(patientIdChar.value) : null;
    console.log(TAG, 'read patientId characteristic', {
      deviceId: connected.id,
      rawBase64: patientIdChar.value,
      decoded: patientId,
    });
    if (patientId !== expectedPatientId) {
      console.warn(TAG, 'patientId mismatch', { deviceId: connected.id, expected: expectedPatientId, received: patientId });
      await connected.cancelConnection().catch(() => {});
      return null;
    }

    const publicKeyChar = await connected.readCharacteristicForService(BLE_SERVICE_UUID, BLE_CHARACTERISTIC_UUIDS.publicKey);
    const publicKeyBase64 = publicKeyChar.value ? base64ToUtf8(publicKeyChar.value) : null;
    console.log(TAG, 'read publicKey characteristic', {
      deviceId: connected.id,
      rawBase64: publicKeyChar.value,
      decoded: publicKeyBase64,
    });
    if (!publicKeyBase64) {
      await connected.cancelConnection().catch(() => {});
      return null;
    }

    console.log(TAG, 'device matched', { deviceId: connected.id });
    return { deviceId: connected.id, publicKeyBase64, device: connected };
  } catch (err) {
    await connected.cancelConnection().catch(() => {});
    throw err;
  }
}

/**
 * Connects to a previously-discovered peer, chunks and writes the sealed envelope to
 * envelope_write, and awaits the patient's envelope_ack notification. A dropped connection or a
 * write failure is reported as 'failed' rather than partially retried — the caller re-runs the
 * whole submission from scratch, since payloads are small enough that resumable chunking isn't
 * worth the complexity for v1.
 */
export async function connectAndSubmit(
  peer: DiscoveredPeer,
  envelopeType: EnvelopeType,
  sealedCiphertextB64: string,
  ackTimeoutMs = 15000,
): Promise<SubmitResult> {
  const wirePayload = encodeBleEnvelopePayload(envelopeType, sealedCiphertextB64);
  const chunks = chunkEnvelope(wirePayload);

  let device: Device;
  try {
    device = await peer.device.connect();
    await device.discoverAllServicesAndCharacteristics();
    await device.requestMTU(512).catch(() => {});
    console.log(TAG, 'connected for submission', { deviceId: peer.deviceId, mtu: device.mtu });
  } catch (err) {
    console.warn(TAG, 'failed to connect for submission', { error: String(err) });
    return 'failed';
  }

  try {
    const ackPromise = new Promise<SubmitResult>((resolve) => {
      console.log(TAG, 'awaiting ack notification', { deviceId: peer.deviceId, ackTimeoutMs });
      const timer = setTimeout(() => {
        subscription.remove();
        console.warn(TAG, 'ack notification timed out', { deviceId: peer.deviceId });
        resolve('failed');
      }, ackTimeoutMs);

      const subscription = device.monitorCharacteristicForService(
        BLE_SERVICE_UUID,
        BLE_CHARACTERISTIC_UUIDS.envelopeAck,
        (error, characteristic) => {
          if (error || !characteristic?.value) return;
          clearTimeout(timer);
          subscription.remove();
          const ackValue = base64ToUtf8(characteristic.value);
          console.log(TAG, 'ack received', { deviceId: peer.deviceId, value: ackValue });
          resolve(ackValue === 'merged' ? 'acked' : 'failed');
        },
      );
    });

    console.log(TAG, 'writing chunks', { deviceId: peer.deviceId, count: chunks.length });
    for (let i = 0; i < chunks.length; i++) {
      await device.writeCharacteristicWithResponseForService(
        BLE_SERVICE_UUID,
        BLE_CHARACTERISTIC_UUIDS.envelopeWrite,
        utf8ToBase64(chunks[i]),
      );
      console.log(TAG, 'chunk written', { deviceId: peer.deviceId, index: i + 1, total: chunks.length });
      if (i < chunks.length - 1) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }
    console.log(TAG, 'all chunks written, awaiting ack', { deviceId: peer.deviceId });

    return await ackPromise;
  } catch (err) {
    console.warn(TAG, 'chunked write failed', { error: String(err) });
    return 'failed';
  } finally {
    await device.cancelConnection().catch(() => {});
  }
}
