import { createContext, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { login as apiLogin, logout as apiLogout, me as apiMe, register as apiRegister } from '@/api/endpoints/auth';
import { registerUnauthenticatedHandler } from '@/api/client';
import { getDeviceName } from '@/auth/device-name';
import { clearToken, loadToken, setToken } from '@/auth/token-storage';
import { clearUser, loadUser, saveUser } from '@/auth/user-storage';
import { setCurrentUserId } from '@/db/context';
import { resetPendingSyncBackoff } from '@/services/pending-sync.service';
import * as medicalInformationRepo from '@/db/repositories/medical-information.repo';
import { queryClient, queryPersister } from '@/lib/query-client';
import { medicalInformationQueryKey } from '@/lib/query-keys';
import type { LoginPayload, MedicalInformationPayload, RegisterPayload, User } from '@/api/types';

type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'unauthenticated';

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  login: (payload: Omit<LoginPayload, 'device_name'>) => Promise<void>;
  register: (payload: Omit<RegisterPayload, 'device_name'>, medicalInfo?: MedicalInformationPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

async function backfillUserId(userId: number): Promise<void> {
  const { getDb } = await import('@/db/client');
  const db = await getDb();
  await db.runAsync('UPDATE medical_information SET user_id = ? WHERE user_id = 0', userId);
  await db.runAsync('UPDATE allergies SET user_id = ? WHERE user_id = 0', userId);
  await db.runAsync('UPDATE diagnoses SET user_id = ? WHERE user_id = 0', userId);
  await db.runAsync('UPDATE emergency_contacts SET user_id = ? WHERE user_id = 0', userId);
  await db.runAsync('UPDATE device_keys SET user_id = ? WHERE user_id = 0', userId);
  await db.runAsync('UPDATE pending_sync_envelopes SET user_id = ? WHERE user_id = 0', userId);
  await db.runAsync('UPDATE professional_attestations SET user_id = ? WHERE user_id = 0', userId);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('idle');
  const [user, setUser] = useState<User | null>(null);

  const handleUnauthenticated = useCallback(async () => {
    setCurrentUserId(null);
    await clearToken();
    resetPendingSyncBackoff();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    registerUnauthenticatedHandler(() => {
      void handleUnauthenticated();
    });
  }, [handleUnauthenticated]);

  useEffect(() => {
    (async () => {
      const token = await loadToken();
      if (!token) {
        setStatus('unauthenticated');
        return;
      }
      try {
        const { user: fetchedUser } = await apiMe();
        setCurrentUserId(fetchedUser.id);
        setUser(fetchedUser);
        setStatus('authenticated');
        void backfillUserId(fetchedUser.id);
        await saveUser(fetchedUser);
      } catch {
        const cached = await loadUser();
        if (cached) {
          setCurrentUserId(cached.id);
          setUser(cached);
          setStatus('authenticated');
          void backfillUserId(cached.id);
        } else {
          await handleUnauthenticated();
        }
      }
    })();
  }, [handleUnauthenticated]);

  const login = useCallback(async (payload: Omit<LoginPayload, 'device_name'>) => {
    setStatus('authenticating');
    const device_name = await getDeviceName();
    const { token, user: loggedInUser } = await apiLogin({ ...payload, device_name });
    await setToken(token);
    setCurrentUserId(loggedInUser.id);
    setUser(loggedInUser);
    setStatus('authenticated');
    void backfillUserId(loggedInUser.id);
    await saveUser(loggedInUser);
  }, []);

  const register = useCallback(async (payload: Omit<RegisterPayload, 'device_name'>, medicalInfo?: MedicalInformationPayload) => {
    setStatus('authenticating');
    const device_name = await getDeviceName();
    const { token, user: registeredUser } = await apiRegister({ ...payload, device_name });
    await setToken(token);
    setCurrentUserId(registeredUser.id);

    if (medicalInfo) {
      await medicalInformationRepo.saveLocalEdit(medicalInfo, 'synced', registeredUser.id);
      queryClient.invalidateQueries({ queryKey: medicalInformationQueryKey });
    }

    setUser(registeredUser);
    setStatus('authenticated');
    void backfillUserId(registeredUser.id);
    await saveUser(registeredUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Best-effort: the user's intent is to log out locally regardless of connectivity.
    }
    setCurrentUserId(null);
    queryClient.clear();
    await queryPersister.removeClient();
    await clearToken();
    await clearUser();
    resetPendingSyncBackoff();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const refreshUser = useCallback(async () => {
    const { user: fetchedUser } = await apiMe();
    setCurrentUserId(fetchedUser.id);
    setUser((prev) => (prev && JSON.stringify(prev) === JSON.stringify(fetchedUser) ? prev : fetchedUser));
    await saveUser(fetchedUser);
  }, []);

  const value = useMemo(
    () => ({ status, user, login, register, logout, refreshUser }),
    [status, user, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
