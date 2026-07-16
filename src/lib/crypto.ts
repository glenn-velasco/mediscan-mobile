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
