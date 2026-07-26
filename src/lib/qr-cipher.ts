import sodium, { ready } from 'react-native-libsodium';

import { QR_CIPHER_KEY_B64 } from '@/constants/qr-cipher-key';

const PREFIX = 'MEDISCAN-ENC:v1:';

let readyPromise: Promise<void> | null = null;

/** libsodium's native (JSI) bindings are usable synchronously; the web/WASM fallback needs `ready` to resolve first. Safe to await on every platform. */
function whenReady(): Promise<void> {
  if (!readyPromise) readyPromise = ready;
  return readyPromise;
}

/**
 * Encrypts the emergency-QR plaintext with the static app key so a generic QR-scanner app sees an
 * opaque blob instead of readable medical text. See `qr-cipher-key.ts` for why this gates casual
 * readers rather than providing real secrecy.
 */
export async function encryptQrPayload(plaintext: string): Promise<string> {
  await whenReady();
  const key = sodium.from_base64(QR_CIPHER_KEY_B64, sodium.base64_variants.ORIGINAL);
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const ciphertext = sodium.crypto_secretbox_easy(plaintext, nonce, key);

  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce, 0);
  combined.set(ciphertext, nonce.length);

  return `${PREFIX}${sodium.to_base64(combined, sodium.base64_variants.ORIGINAL)}`;
}

/**
 * Reverses `encryptQrPayload()`. Returns `null` (never throws) if the prefix doesn't match or
 * decryption fails — wrong format, corrupted data, or not a MediScan QR at all — so callers can
 * treat this as the single "not a MediScan QR" gate.
 */
export async function decryptQrPayload(encoded: string): Promise<string | null> {
  if (!encoded.startsWith(PREFIX)) return null;

  await whenReady();
  try {
    const key = sodium.from_base64(QR_CIPHER_KEY_B64, sodium.base64_variants.ORIGINAL);
    const combined = sodium.from_base64(encoded.slice(PREFIX.length), sodium.base64_variants.ORIGINAL);
    const nonce = combined.slice(0, sodium.crypto_secretbox_NONCEBYTES);
    const ciphertext = combined.slice(sodium.crypto_secretbox_NONCEBYTES);
    const plaintextBytes = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
    return new TextDecoder().decode(plaintextBytes);
  } catch {
    return null;
  }
}
