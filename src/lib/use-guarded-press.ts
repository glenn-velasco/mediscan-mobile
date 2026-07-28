import { useRef } from 'react';

/**
 * Wrap any onPress handler that triggers navigation (router.push/navigate, or opening a
 * bottom sheet route) with this hook. Rapidly repeated taps on the same pressable —
 * e.g. from a laggy transition or a user double/triple tapping a link — will otherwise
 * fire the handler once per tap, pushing duplicate screens onto the stack and making
 * back-navigation walk through several copies of the same page. This locks the handler
 * for `delay` ms after the first call so a tap burst results in exactly one navigation.
 *
 * Use this on every onPress that calls router.push/navigate directly, not just where a
 * bug has already been reported — it's cheap and prevents the same class of issue
 * elsewhere.
 */
export function useGuardedPress<T extends (...args: any[]) => void>(fn: T, delay = 800): T {
  const lockedUntil = useRef(0);
  return (
    (...args: Parameters<T>) => {
      const now = Date.now();
      if (now < lockedUntil.current) return;
      lockedUntil.current = now + delay;
      fn(...args);
    }
  ) as T;
}
