import sodium from 'react-native-libsodium';

import { getDeviceName } from '@/auth/device-name';
import * as deviceKeyRepo from '@/db/repositories/device-key.repo';
import { registerDeviceKey, revokeDeviceKey } from '@/api/endpoints/device-keys';
import { generateKeypair, type Keypair } from '@/services/sealed-box.service';
import * as deviceKeyStorage from '@/services/device-key-storage';
import { getIsOffline } from '@/lib/network-state';

class NoDeviceKeyError extends Error {
  constructor() {
    super('No device key is registered on this device yet.');
    this.name = 'NoDeviceKeyError';
  }
}

/**
 * Generates and stores a device keypair locally if one isn't already set up.
 * Works fully offline — BLE sync can start immediately without a server round-trip.
 * Safe to call on every authenticated app boot.
 */
export async function ensureDeviceKeyRegistered(): Promise<void> {
  const [localRow, privateKey] = await Promise.all([deviceKeyRepo.getLocal(), deviceKeyStorage.loadPrivateKey()]);
  if (localRow && privateKey) return;

  const keypair = await generateKeypair();
  const publicKeyB64 = sodium.to_base64(keypair.publicKey, sodium.base64_variants.ORIGINAL);
  await deviceKeyStorage.setPrivateKey(sodium.to_base64(keypair.privateKey));

  const label = await getDeviceName();
  await deviceKeyRepo.saveLocal({ publicKey: publicKeyB64, label });
}

/**
 * Registers the local device keypair with the server if it hasn't been registered yet.
 * Requires internet — call from sync triggers on reconnect or foreground.
 */
export async function ensureDeviceKeyServerRegistered(): Promise<void> {
  if (getIsOffline()) return;
  const localRow = await deviceKeyRepo.getLocal();
  if (!localRow) return;
  if (localRow.server_device_key_id != null) return;

  try {
    const registered = await registerDeviceKey({ public_key: localRow.public_key, label: localRow.label ?? undefined });
    await deviceKeyRepo.saveRegistered({
      serverDeviceKeyId: registered.id,
      publicKey: localRow.public_key,
      label: registered.label,
      registeredAt: registered.registered_at,
    });
  } catch {
    // Left without server_device_key_id for the next retry attempt.
  }
}

/**
 * Registers a new key, marks the old one for revocation, and attempts the revoke immediately. If the
 * revoke call fails (offline, etc.) the old server key id stays marked `pending_revoke_server_id` so a
 * later call can retry it — mirrors the legacy mutation queue's `reconcileInterruptedSyncs` pattern of
 * making an interrupted operation safely retryable rather than lost.
 */
export async function rotateDeviceKey(): Promise<void> {
  const existing = await deviceKeyRepo.getLocal();
  const oldServerDeviceKeyId = existing?.server_device_key_id ?? existing?.pending_revoke_server_id ?? null;

  const keypair = await generateKeypair();
  const publicKeyB64 = sodium.to_base64(keypair.publicKey, sodium.base64_variants.ORIGINAL);
  await deviceKeyStorage.setPrivateKey(sodium.to_base64(keypair.privateKey));

  const label = await getDeviceName();
  const registered = await registerDeviceKey({ public_key: publicKeyB64, label });
  await deviceKeyRepo.saveRegistered({
    serverDeviceKeyId: registered.id,
    publicKey: publicKeyB64,
    label: registered.label,
    registeredAt: registered.registered_at,
  });

  if (oldServerDeviceKeyId != null) {
    await deviceKeyRepo.markPendingRevoke(oldServerDeviceKeyId);
    await retryPendingRevoke();
  }
}

/** Retries a revoke left over from an interrupted rotation. Safe/cheap to call on every app foreground. */
export async function retryPendingRevoke(): Promise<void> {
  if (getIsOffline()) return;
  const local = await deviceKeyRepo.getLocal();
  if (local?.pending_revoke_server_id == null) return;

  try {
    await revokeDeviceKey(local.pending_revoke_server_id);
    await deviceKeyRepo.clearPendingRevoke();
  } catch {
    // Left marked pending_revoke_server_id for the next retry attempt.
  }
}

export async function getPrivateKeypair(): Promise<Keypair> {
  const [localRow, privateKeyB64] = await Promise.all([deviceKeyRepo.getLocal(), deviceKeyStorage.loadPrivateKey()]);
  if (!localRow || !privateKeyB64) throw new NoDeviceKeyError();

  return {
    publicKey: sodium.from_base64(localRow.public_key, sodium.base64_variants.ORIGINAL),
    privateKey: sodium.from_base64(privateKeyB64),
  };
}

export { NoDeviceKeyError };
