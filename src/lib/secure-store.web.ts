const memoryFallback = new Map<string, string>();

function canUseLocalStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export async function getItemAsync(key: string): Promise<string | null> {
  if (canUseLocalStorage()) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      // Fall back to in-memory storage if storage is blocked (e.g. private browsing restrictions).
    }
  }
  return memoryFallback.get(key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  memoryFallback.set(key, value);
  if (canUseLocalStorage()) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Ignore quota/security errors and keep in memory.
    }
  }
}

export async function deleteItemAsync(key: string): Promise<void> {
  memoryFallback.delete(key);
  if (canUseLocalStorage()) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore errors.
    }
  }
}
