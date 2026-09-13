import { useEffect } from 'react';
import { useCameraPermissions } from 'expo-camera';

import { useBleCentralPermission, useBlePeripheralPermission } from '@/hooks/use-ble-permission';
import { ensureNotificationPermission } from '@/features/qr-widget/qr-notification';
import { usePermissionsPrimer } from '@/onboarding/usePermissionsPrimer';

/**
 * Fires every permission request the app can use, back to back, the first time the app runs
 * (gated by `enabled`, driven by the `primed` flag) — no dedicated screen, the native OS prompts
 * are the only UI. Every existing lazy/inline prompt (useBleScan, useBleAdvertising, useQrWidget,
 * ...) stays untouched as the fallback for anything skipped, denied, or revoked later.
 */
export function usePrimePermissions(enabled: boolean) {
  const { complete } = usePermissionsPrimer();
  const [, requestCentralPermission] = useBleCentralPermission();
  const [, requestPeripheralPermission] = useBlePeripheralPermission();
  const [, requestCameraPermission] = useCameraPermissions();

  useEffect(() => {
    if (!enabled) return;
    const schedule = (globalThis as unknown as { requestIdleCallback?: (callback: () => void) => number }).requestIdleCallback;
    const cancelIdle = (globalThis as unknown as { cancelIdleCallback?: (handle: number) => void }).cancelIdleCallback;
    const handle = schedule ? schedule(() => {
      (async () => {
        // react-doctor-disable-next-line react-hooks-js/todo
        try {
          await requestCentralPermission();
          await requestPeripheralPermission();
          await ensureNotificationPermission();
          await requestCameraPermission();
        } finally {
          void complete();
        }
      })();
    }) : setTimeout(() => {
      (async () => {
        try {
          await requestCentralPermission();
          await requestPeripheralPermission();
          await ensureNotificationPermission();
          await requestCameraPermission();
        } finally { void complete(); }
      })();
    }, 0);
    return () => schedule ? cancelIdle?.(handle as number) : clearTimeout(handle as ReturnType<typeof setTimeout>);
    // Runs once when `enabled` flips true — the request/complete callbacks are stable enough
    // for a one-shot priming effect and re-running it on their identity churn isn't desired.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
