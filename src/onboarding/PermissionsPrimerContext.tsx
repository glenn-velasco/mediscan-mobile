import { createContext, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'mediscan_has_primed_permissions';

type PermissionsPrimerContextValue = {
  primed: boolean | null;
  complete: () => Promise<void>;
};

export const PermissionsPrimerContext = createContext<PermissionsPrimerContextValue | null>(null);

export function PermissionsPrimerProvider({ children }: PropsWithChildren) {
  const [primed, setPrimed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const value = await AsyncStorage.getItem(STORAGE_KEY);
      setPrimed(value === 'true');
    })();
  }, []);

  const complete = useCallback(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, 'true');
    setPrimed(true);
  }, []);

  const value = useMemo(() => ({ primed, complete }), [primed, complete]);

  return <PermissionsPrimerContext.Provider value={value}>{children}</PermissionsPrimerContext.Provider>;
}
