// A short-lived, in-memory grant after device authentication. Never put unlock state in a route URL.
let unlockedUntil = 0;

export function grantRecentScanAccess(): void {
  unlockedUntil = Date.now() + 5 * 60 * 1000;
}

export function hasRecentScanAccess(): boolean {
  return Date.now() < unlockedUntil;
}
