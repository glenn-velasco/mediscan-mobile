import * as SecureStore from 'expo-secure-store';

import { getCurrentUserId, hasCurrentUser } from '@/db/context';

const PRIVATE_KEY_PREFIX = 'mediscan_device_private_key';

const cache = new Map<string, string | null | undefined>();

/** Returns the per-user SecureStore key, or null if no user is logged in. */
function storageKey(): string | null {
  if (!hasCurrentUser()) return null;
  return `${PRIVATE_KEY_PREFIX}_${getCurrentUserId()}`;
}

export async function loadPrivateKey(): Promise<string | null> {
  const key = storageKey();
  if (!key) return null;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const value = await SecureStore.getItemAsync(key);
  cache.set(key, value);
  return value;
}

function getCachedPrivateKey(): string | null {
  const key = storageKey();
  if (!key) return null;
  const cached = cache.get(key);
  return cached ?? null;
}

export async function setPrivateKey(privateKeyB64: string): Promise<void> {
  const key = storageKey();
  if (!key) return;
  cache.set(key, privateKeyB64);
  await SecureStore.setItemAsync(key, privateKeyB64);
}

export async function clearPrivateKey(): Promise<void> {
  const key = storageKey();
  if (!key) {
    cache.clear();
    return;
  }
  cache.set(key, null);
  await SecureStore.deleteItemAsync(key);
}
