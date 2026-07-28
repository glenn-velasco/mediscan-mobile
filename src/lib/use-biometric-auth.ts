import { useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';

export type BiometricAuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'failed' | 'unavailable';

export function useBiometricAuth() {
  const [status, setStatus] = useState<BiometricAuthStatus>('idle');

  const authenticate = async () => {
    setStatus('authenticating');
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
  };

  const reset = () => setStatus('idle');

  return { status, authenticate, reset };
}
