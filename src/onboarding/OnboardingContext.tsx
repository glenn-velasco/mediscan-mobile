import { createContext, useEffect, useState, type PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'mediscan_has_seen_onboarding';

type OnboardingContextValue = {
  seen: boolean | null;
  complete: () => Promise<void>;
};

// react-doctor-disable-next-line react-doctor/only-export-components
export const OnboardingContext = createContext<OnboardingContextValue | null>(null);

// react-doctor-disable-next-line react-doctor/only-export-components, deslop/unused-export
export function OnboardingProvider({ children }: PropsWithChildren) {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const value = await AsyncStorage.getItem(STORAGE_KEY);
      setSeen(value === 'true');
    })();
  }, []);

  const complete = async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
    setSeen(true);
  };

  const value = { seen, complete };

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}
