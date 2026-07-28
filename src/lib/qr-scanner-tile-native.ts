import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const ROUTE_EVENT = 'QrScannerTileRoute';

/**
 * MainActivity sets showWhenLocked/turnScreenOn when launched from the Quick Settings tile (see
 * plugins/withQrScannerTile.js). Call this once the quick-scan route is left so those flags don't
 * leak into the rest of the app — otherwise every screen would keep rendering over the lock screen.
 */
export function clearQuickScanLockScreenFlags() {
  if (Platform.OS !== 'android') return;
  NativeModules.QrScannerTileModule?.clearLockScreenFlags?.();
}

/**
 * Reads (and clears) the route the tile launched with, for the cold-start case where MainActivity
 * received the intent before JS finished mounting. Returns null when the app wasn't launched from
 * the tile, or a route wasn't set, or was already consumed.
 */
export async function getPendingQuickScanRoute(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const ROUTE_TIMEOUT_MS = 3_000;
    const route = await Promise.race([
      NativeModules.QrScannerTileModule?.consumePendingRoute?.(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), ROUTE_TIMEOUT_MS)),
    ]);
    return route ?? null;
  } catch {
    return null;
  }
}

/**
 * Subscribes to warm-start tile launches, where MainActivity.onNewIntent fires while JS is already
 * running. Returns an unsubscribe function.
 */
export function addQuickScanRouteListener(callback: (route: string) => void): () => void {
  if (Platform.OS !== 'android' || !NativeModules.QrScannerTileModule) {
    return () => {};
  }
  const emitter = new NativeEventEmitter(NativeModules.QrScannerTileModule);
  const subscription = emitter.addListener(ROUTE_EVENT, callback);
  return () => subscription.remove();
}
