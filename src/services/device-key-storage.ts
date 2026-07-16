import * as SecureStore from 'expo-secure-store';

import { getCurrentUserId } from '@/db/context';

const PRIVATE_KEY_PREFIX = 'mediscan_device_private_key';

const cache = new Map<string, string | null | undefined>();

function storageKey(): string {
  const userId = getCurrentUserId();
  return `${PRIVATE_KEY_PREFIX}_${userId}`;
}

export async function loadPrivateKey(): Promise<string | null> {
  const key = storageKey();
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const value = await SecureStore.getItemAsync(key);
  cache.set(key, value);
  return value;
}

export function getCachedPrivateKey(): string | null {
  const key = storageKey();
  const cached = cache.get(key);
  return cached ?? null;
}

export async function setPrivateKey(privateKeyB64: string): Promise<void> {
  const key = storageKey();
  cache.set(key, privateKeyB64);
  await SecureStore.setItemAsync(key, privateKeyB64);
}

export async function clearPrivateKey(): Promise<void> {
  const key = storageKey();
  cache.set(key, null);
  await SecureStore.deleteItemAsync(key);
}
