import * as SecureStore from 'expo-secure-store';
import sodium, { ready } from 'react-native-libsodium';

const KEY_PREFIX = 'mediscan_emergency_signing_key_';

type StoredSigningKey = { publicKey: string; privateKey: string; createdAt: string };

export async function getOrCreateEmergencySigningKey(patientId: string | number): Promise<StoredSigningKey> {
  await ready;
  const storageKey = `${KEY_PREFIX}${patientId}`;
  const stored = await SecureStore.getItemAsync(storageKey);
  if (stored) {
    try {
      return JSON.parse(stored) as StoredSigningKey;
    } catch {
      await SecureStore.deleteItemAsync(storageKey);
    }
  }
  const pair = sodium.crypto_sign_keypair();
  const value: StoredSigningKey = {
    publicKey: sodium.to_base64(pair.publicKey, sodium.base64_variants.ORIGINAL),
    privateKey: sodium.to_base64(pair.privateKey, sodium.base64_variants.ORIGINAL),
    createdAt: new Date().toISOString(),
  };
  await SecureStore.setItemAsync(storageKey, JSON.stringify(value));
  return value;
}

export async function signEmergencyPayload(patientId: string | number, canonicalPayload: string) {
  await ready;
  const key = await getOrCreateEmergencySigningKey(patientId);
  const signature = sodium.crypto_sign_detached(
    canonicalPayload,
    sodium.from_base64(key.privateKey, sodium.base64_variants.ORIGINAL),
  );
  return {
    publicKey: key.publicKey,
    issuedAt: key.createdAt,
    signature: sodium.to_base64(signature, sodium.base64_variants.ORIGINAL),
  };
}

export async function verifyEmergencyPayload(canonicalPayload: string, signatureB64: string, publicKeyB64: string): Promise<boolean> {
  await ready;
  try {
    return sodium.crypto_sign_verify_detached(
      sodium.from_base64(signatureB64, sodium.base64_variants.ORIGINAL),
      canonicalPayload,
      sodium.from_base64(publicKeyB64, sodium.base64_variants.ORIGINAL),
    );
  } catch {
    return false;
  }
}
