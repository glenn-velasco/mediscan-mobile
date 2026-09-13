import * as SecureStore from 'expo-secure-store';
import sodium, { ready } from 'react-native-libsodium';

const STORAGE_KEY = 'mediscan_recent_scan_secretbox_key_v1';

async function getKey(): Promise<Uint8Array> {
  await ready;
  let encoded = await SecureStore.getItemAsync(STORAGE_KEY);
  if (!encoded) {
    encoded = sodium.to_base64(sodium.crypto_secretbox_keygen(), sodium.base64_variants.ORIGINAL);
    await SecureStore.setItemAsync(STORAGE_KEY, encoded);
  }
  return sodium.from_base64(encoded, sodium.base64_variants.ORIGINAL);
}

export async function encryptRecentScan(value: unknown): Promise<string> {
  await ready;
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = sodium.crypto_secretbox_easy(JSON.stringify(value), nonce, await getKey());
  return `${sodium.to_base64(nonce, sodium.base64_variants.URLSAFE_NO_PADDING)}.${sodium.to_base64(ciphertext, sodium.base64_variants.URLSAFE_NO_PADDING)}`;
}

export async function decryptRecentScan<T>(encoded: string): Promise<T | null> {
  await ready;
  try {
    const [nonceValue, ciphertextValue] = encoded.split('.');
    if (!nonceValue || !ciphertextValue) return null;
    const plaintext = sodium.crypto_secretbox_open_easy(
      sodium.from_base64(ciphertextValue, sodium.base64_variants.URLSAFE_NO_PADDING),
      sodium.from_base64(nonceValue, sodium.base64_variants.URLSAFE_NO_PADDING),
      await getKey(),
    );
    return JSON.parse(sodium.to_string(plaintext)) as T;
  } catch {
    return null;
  }
}
