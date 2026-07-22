import { createContext, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'mediscan_has_seen_onboarding';

type OnboardingContextValue = {
  seen: boolean | null;
  complete: () => Promise<void>;
};

export const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: PropsWithChildren) {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const value = await AsyncStorage.getItem(STORAGE_KEY);
      setSeen(value === 'true');
    })();
  }, []);

  const complete = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
    setSeen(true);
  }, []);

  const value = useMemo(() => ({ seen, complete }), [seen, complete]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}
