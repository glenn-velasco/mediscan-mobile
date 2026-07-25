import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { OnboardingContext } from '@/onboarding/OnboardingContext';
import { PermissionsPrimerContext } from '@/onboarding/PermissionsPrimerContext';

const ONBOARDING_KEY = 'mediscan_has_seen_onboarding';
const PERMISSIONS_KEY = 'mediscan_has_primed_permissions';

/**
 * Reads both onboarding + permissions-primer flags from AsyncStorage in a single
 * parallel batch instead of two sequential nested providers — saves one full
 * AsyncStorage round-trip on every cold start.
 */
export function BootProvider({ children }: PropsWithChildren) {
  const [seen, setSeen] = useState<boolean | null>(null);
  const [primed, setPrimed] = useState<boolean | null>(null);

  useEffect(() => {
    void Promise.all([
      AsyncStorage.getItem(ONBOARDING_KEY),
      AsyncStorage.getItem(PERMISSIONS_KEY),
    ]).then(([onboardingValue, permissionsValue]) => {
      setSeen(onboardingValue === 'true');
      setPrimed(permissionsValue === 'true');
    });
  }, []);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setSeen(true);
  }, []);

  const completePermissions = useCallback(async () => {
    await AsyncStorage.setItem(PERMISSIONS_KEY, 'true');
    setPrimed(true);
  }, []);

  const onboardingValue = useMemo(() => ({ seen, complete: completeOnboarding }), [seen, completeOnboarding]);
  const permissionsValue = useMemo(() => ({ primed, complete: completePermissions }), [primed, completePermissions]);

  return (
    <OnboardingContext.Provider value={onboardingValue}>
      <PermissionsPrimerContext.Provider value={permissionsValue}>
        {children}
      </PermissionsPrimerContext.Provider>
    </OnboardingContext.Provider>
  );
}
