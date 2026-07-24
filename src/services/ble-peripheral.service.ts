import * as Crypto from 'expo-crypto';

import BlePeripheralNative from '../../modules/ble-peripheral/src/BlePeripheral';
import * as deviceKeyRepo from '@/db/repositories/device-key.repo';
import * as pendingSyncEnvelopeRepo from '@/db/repositories/pending-sync-envelope.repo';
import { NoDeviceKeyError } from '@/services/device-key.service';
import { processEnvelope } from '@/services/merge.service';
import { ChunkReassembler } from '@/lib/ble-chunking';
import { decodeBleEnvelopePayload } from '@/lib/ble-envelope-wire';
import type { EnvelopeType } from '@/api/types';

const TAG = '[BlePeripheralService]';

const reassembler = new ChunkReassembler();
let subscriptions: { remove(): void }[] = [];
let advertising = false;

function isEnvelopeType(value: string): value is EnvelopeType {
  return value === 'allergy_verification' || 
         value === 'condition_verification' || 
         value === 'diagnosis_verification' || 
         value === 'medication_verification' || 
         value === 'transfusion_witness' || 
         value === 'general_note' || 
         value === 'medical_information_update';
}

async function handleCompleteEnvelope(wirePayload: string): Promise<void> {
  console.debug(TAG, 'Envelope reassembly complete, processing');
  const decoded = decodeBleEnvelopePayload(wirePayload);
  if (!decoded || !isEnvelopeType(decoded.envelopeType)) {
    console.warn(TAG, 'Received malformed BLE envelope, discarding');
    await BlePeripheralNative.sendAck('failed:malformed_payload').catch(() => {});
    return;
  }
  console.debug(TAG, 'Envelope decoded', { envelopeType: decoded.envelopeType });

  const localId = Crypto.randomUUID();
  await pendingSyncEnvelopeRepo.insertReceived({
    localId,
    serverEnvelopeId: null,
    transport: 'ble',
    senderId: null,
    envelopeType: decoded.envelopeType,
    ciphertext: decoded.ciphertextB64,
    expiresAt: null,
  });
  console.debug(TAG, 'Envelope stored locally', { localId, envelopeType: decoded.envelopeType });

  const row = await pendingSyncEnvelopeRepo.getByLocalId(localId);
  if (!row) {
    console.warn(TAG, 'Row not found after insert, sending ack failed:internal_error');
    await BlePeripheralNative.sendAck('failed:internal_error').catch(() => {});
    return;
  }

  console.debug(TAG, 'Processing envelope via merge service', { localId, envelopeType: decoded.envelopeType });
  const result = await processEnvelope(row);
  console.debug(TAG, 'Envelope processed', { localId, result });
  const ackValue = result === 'merged' ? 'merged' : `failed:${result}`;
  console.debug(TAG, 'Sending ack', { ackValue });
  await BlePeripheralNative.sendAck(ackValue).catch((err) => {
    console.warn(TAG, 'Failed to notify envelope_ack characteristic', { error: String(err) });
  });
}

function handleChunk(chunk: string): void {
  // Log seq/total from chunk header for progress tracking
  const seq = parseInt(chunk.slice(0, 4), 16);
  const total = parseInt(chunk.slice(4, 8), 16);
  console.log(TAG, 'chunk received', { seq: seq + 1, total, firstBytes: chunk.slice(8, 16) });

  const result = reassembler.addChunk(chunk);
  if (result.status === 'incomplete') {
    console.log(TAG, 'awaiting more chunks', { received: seq + 1, total });
    return;
  }

  reassembler.reset();
  if (result.status === 'corrupted') {
    console.warn(TAG, 'discarding corrupted chunk sequence', { reason: result.reason });
    void BlePeripheralNative.sendAck('failed:corrupted_transfer').catch(() => {});
    return;
  }

  console.log(TAG, 'all chunks received, reassembling envelope');
  void handleCompleteEnvelope(result.payload);
}

/**
 * Starts advertising the fixed GATT service so a nearby professional device can connect and
 * submit a sealed envelope without a network round-trip (Scenario 1). Requires an already
 * -registered device key (see device-key.service.ensureDeviceKeyRegistered, run at app boot).
 */
export async function startAdvertising(patientId: number): Promise<void> {
  const localKey = await deviceKeyRepo.getLocal();
  if (!localKey) throw new NoDeviceKeyError();

  reassembler.reset();
  subscriptions.forEach((sub) => sub.remove());
  subscriptions = [
    BlePeripheralNative.addListener('onEnvelopeChunkReceived', (event) => handleChunk(event.chunk)),
    BlePeripheralNative.addListener('onCentralDisconnected', () => reassembler.reset()),
  ];

  console.log(TAG, 'starting advertising', { patientId, serviceUuid: '5b6a3a10-3f0e-4b8e-9b6e-9a6f1a2b3c10' });
  await BlePeripheralNative.startAdvertising(String(patientId), localKey.public_key);
  console.log(TAG, 'advertising started');
  advertising = true;
}

export async function stopAdvertising(): Promise<void> {
  subscriptions.forEach((sub) => sub.remove());
  subscriptions = [];
  reassembler.reset();
  advertising = false;
  await BlePeripheralNative.stopAdvertising();
}

export function isAdvertising(): boolean {
  return advertising;
}
