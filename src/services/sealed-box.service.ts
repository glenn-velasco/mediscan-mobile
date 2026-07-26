import sodium, { ready } from 'react-native-libsodium';

export type Keypair = { publicKey: Uint8Array; privateKey: Uint8Array };

let readyPromise: Promise<void> | null = null;

/** libsodium's native (JSI) bindings are usable synchronously; the web/WASM fallback needs `ready` to resolve first. Safe to await on every platform. */
function whenReady(): Promise<void> {
  if (!readyPromise) readyPromise = ready;
  return readyPromise;
}

/** Generates a new sealed-box keypair. The private key must never leave the device (see device-key-storage.ts). */
export async function generateKeypair(): Promise<Keypair> {
  await whenReady();
  const { publicKey, privateKey } = sodium.crypto_box_keypair();
  return { publicKey, privateKey };
}

/** Seals a JSON-serializable value to a recipient's public key. Only that key's matching private key can open it. */
export async function seal(plaintext: unknown, recipientPublicKeyB64: string): Promise<string> {
  await whenReady();
  const recipientPublicKey = sodium.from_base64(recipientPublicKeyB64, sodium.base64_variants.ORIGINAL);
  const sealed = sodium.crypto_box_seal(JSON.stringify(plaintext), recipientPublicKey);
  return sodium.to_base64(sealed);
}

/**
 * Opens a sealed-box ciphertext with the recipient's own keypair. Returns `null` (never throws) on any
 * failure — wrong key, corrupted ciphertext, malformed JSON — so callers can branch cleanly into a
 * "don't acknowledge this envelope" path instead of needing a try/catch at every call site.
 */
export async function unseal<T>(ciphertextB64: string, keypair: Keypair): Promise<T | null> {
  await whenReady();
  try {
    const ciphertext = sodium.from_base64(ciphertextB64);
    const plaintextBytes = sodium.crypto_box_seal_open(ciphertext, keypair.publicKey, keypair.privateKey);
    const plaintext = new TextDecoder().decode(plaintextBytes);
    return JSON.parse(plaintext) as T;
  } catch {
    return null;
  }
}
