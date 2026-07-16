const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;

export function backoffDelayMs(attemptCount: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** attemptCount, MAX_BACKOFF_MS);
}
