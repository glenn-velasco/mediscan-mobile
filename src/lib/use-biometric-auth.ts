import { useCallback, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricAuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'failed' | 'unavailable';

export function useBiometricAuth() {
  const [status, setStatus] = useState<BiometricAuthStatus>('idle');

  const authenticate = useCallback(async () => {
    setStatus('authenticating');
    // Don't pre-gate on hasHardwareAsync/isEnrolledAsync — those only check for biometric
    // hardware/enrollment, so a device secured with just a PIN/pattern/password (no fingerprint or
    // face enrolled) would be wrongly reported as unavailable even though authenticateAsync's
    // device-credential fallback handles that case fine. Attempt directly and classify from the
    // actual result instead.
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock to view scanned medical info',
      fallbackLabel: 'Use passcode',
      disableDeviceFallback: false,
    });
    if (result.success) {
      setStatus('authenticated');
      return true;
    }
    const noSecuritySet = result.error === 'not_enrolled' || result.error === 'passcode_not_set' || result.error === 'not_available';
    setStatus(noSecuritySet ? 'unavailable' : 'failed');
    return false;
  }, []);

  const reset = useCallback(() => setStatus('idle'), []);

  return { status, authenticate, reset };
}
