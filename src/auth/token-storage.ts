import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'mediscan_auth_token';

let cachedToken: string | null | undefined;

export async function loadToken(): Promise<string | null> {
  if (cachedToken !== undefined) return cachedToken;
  cachedToken = await SecureStore.getItemAsync(TOKEN_KEY);
  return cachedToken;
}

export function getCachedToken(): string | null {
  return cachedToken ?? null;
}

export async function setToken(token: string): Promise<void> {
  cachedToken = token;
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  cachedToken = null;
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
