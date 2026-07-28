import { createContext, useEffect, useState, type PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'mediscan_has_primed_permissions';

type PermissionsPrimerContextValue = {
  primed: boolean | null;
  complete: () => Promise<void>;
};

// react-doctor-disable-next-line react-doctor/only-export-components
export const PermissionsPrimerContext = createContext<PermissionsPrimerContextValue | null>(null);

// react-doctor-disable-next-line react-doctor/only-export-components, deslop/unused-export
export function PermissionsPrimerProvider({ children }: PropsWithChildren) {
  const [primed, setPrimed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const value = await AsyncStorage.getItem(STORAGE_KEY);
      setPrimed(value === 'true');
    })();
  }, []);

  const complete = async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
    setPrimed(true);
  };

  const value = { primed, complete };

  return <PermissionsPrimerContext.Provider value={value}>{children}</PermissionsPrimerContext.Provider>;
}
