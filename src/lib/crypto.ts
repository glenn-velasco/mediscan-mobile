import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';

const KEY_STORAGE_KEY = 'mediscan_aes_key';

let cachedKey: string | null = null;

/** Returns the device's local AES-256 key, generating and persisting one (in SecureStore's hardware-backed keychain/keystore) on first use. */
async function getOrCreateKey(): Promise<string> {
  if (cachedKey) return cachedKey;

  let key = await SecureStore.getItemAsync(KEY_STORAGE_KEY);
  if (!key) {
    key = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
    await SecureStore.setItemAsync(KEY_STORAGE_KEY, key);
  }
  cachedKey = key;
  return key;
}

/** Encrypts a JSON-serializable value with AES-256-CBC. Returns `${iv}:${ciphertext}`, both hex/base64 text safe to store in a SQLite TEXT column. */
export async function encryptJson<T>(data: T): Promise<string> {
  const key = await getOrCreateKey();
  const iv = CryptoJS.lib.WordArray.random(16);
  const ciphertext = CryptoJS.AES.encrypt(JSON.stringify(data), CryptoJS.enc.Hex.parse(key), { iv }).toString();
  return `${iv.toString(CryptoJS.enc.Hex)}:${ciphertext}`;
}

/** Reverses `encryptJson`. Returns null for empty/malformed input (e.g. a not-yet-populated row). */
export async function decryptJson<T>(payload: string | null | undefined): Promise<T | null> {
  if (!payload) return null;

  const [ivHex, ciphertext] = payload.split(':');
  if (!ivHex || !ciphertext) return null;

  const key = await getOrCreateKey();
  const plaintext = CryptoJS.AES.decrypt(ciphertext, CryptoJS.enc.Hex.parse(key), {
    iv: CryptoJS.enc.Hex.parse(ivHex),
  }).toString(CryptoJS.enc.Utf8);

  if (!plaintext) return null;
  return JSON.parse(plaintext) as T;
}

/**
 * Encrypts a single string value with AES-256-CBC, one PHI column at a time
 * rather than a whole-row JSON blob (see migration 011 for why: per-field
 * columns let each field be read/written independently instead of forcing a
 * decrypt of the entire row to read one value). Same `${iv}:${ciphertext}`
 * format and key as `encryptJson` - just applied to a plain string.
 */
export async function encryptField(value: string | null | undefined): Promise<string | null> {
  if (value === null || value === undefined) return null;

  const key = await getOrCreateKey();
  const iv = CryptoJS.lib.WordArray.random(16);
  const ciphertext = CryptoJS.AES.encrypt(value, CryptoJS.enc.Hex.parse(key), { iv }).toString();
  return `${iv.toString(CryptoJS.enc.Hex)}:${ciphertext}`;
}

/** Reverses `encryptField`. Returns null for empty/malformed input. */
export async function decryptField(payload: string | null | undefined): Promise<string | null> {
  if (!payload) return null;

  const [ivHex, ciphertext] = payload.split(':');
  if (!ivHex || !ciphertext) return null;

  const key = await getOrCreateKey();
  const plaintext = CryptoJS.AES.decrypt(ciphertext, CryptoJS.enc.Hex.parse(key), {
    iv: CryptoJS.enc.Hex.parse(ivHex),
  }).toString(CryptoJS.enc.Utf8);

  return plaintext || null;
}
