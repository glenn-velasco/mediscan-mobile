import { createContext, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { registerUnauthenticatedHandler } from '@/api/client';
import { login as apiLogin, logout as apiLogout, me as apiMe, register as apiRegister } from '@/api/endpoints/auth';
import { updateMedicalInformation } from '@/api/endpoints/medical-information';
import type { LoginPayload, MedicalInformationPayload, RegisterPayload, User } from '@/api/types';
import { getDeviceName } from '@/auth/device-name';
import { clearToken, loadToken, setToken } from '@/auth/token-storage';
import { clearUser, loadUser, saveUser } from '@/auth/user-storage';
import { resetDb } from '@/db/client';
import { setCurrentUserId } from '@/db/context';
import * as medicalInformationRepo from '@/db/repositories/medical-information.repo';
import { queryClient, queryPersister } from '@/lib/query-client';
import { medicalInformationQueryKey } from '@/lib/query-keys';
import { clearPrivateKey } from '@/services/device-key-storage';
import { resetPendingSyncBackoff } from '@/services/pending-sync.service';

type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'unauthenticated';

let isRegistering = false;

/** Returns true while a registration is in progress — used by sync triggers to avoid overwriting freshly-saved data. */
export function getIsRegistering(): boolean {
  return isRegistering;
}

type AuthContextValue = {
  status: AuthStatus;
  user: User | null;
  /** True while the initial user refresh (apiMe) is in flight after restore. Prevents the home
   *  screen from flashing the "create profile" empty state when the cached user lacks data. */
  isInitialLoading: boolean;
  login: (payload: Omit<LoginPayload, 'device_name'>) => Promise<void>;
  /**
   * Resolves `{ pending: true }` when the submitted name+dob matched an existing record and the
   * registration is held awaiting that record's primary user's confirmation - no account/session
   * is created in that case, so `status` stays 'unauthenticated'. Otherwise resolves
   * `{ pending: false }` after logging the new account in normally.
   */
  register: (
    payload: Omit<RegisterPayload, 'device_name'>,
    medicalInfo?: MedicalInformationPayload,
  ) => Promise<{ pending: boolean }>;
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

type AuthProviderProps = PropsWithChildren<{
  /**
   * Skips the apiMe() network call and db backfill on init, using only the cached token/user from
   * SecureStore/AsyncStorage. Used by the lightweight quick-scan boot path (see src/app/_layout.tsx)
   * so a cold tile launch doesn't pay for a network round trip before it can render.
   */
  skipNetworkRefresh?: boolean;
}>;

export function AuthProvider({ children, skipNetworkRefresh }: AuthProviderProps) {
  const [status, setStatus] = useState<AuthStatus>('idle');
  const [user, setUser] = useState<User | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const handleUnauthenticated = useCallback(async () => {
    await clearPrivateKey();
    await resetDb();
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
        setIsInitialLoading(false);
        return;
      }

      const cached = await loadUser();

      if (skipNetworkRefresh) {
        if (cached) {
          setCurrentUserId(cached.id);
          setUser(cached);
          setStatus('authenticated');
        } else {
          setStatus('unauthenticated');
        }
        setIsInitialLoading(false);
        return;
      }

      if (cached) {
        setCurrentUserId(cached.id);
        setUser(cached);
        setStatus('authenticated');
        void backfillUserId(cached.id);
      }

      try {
        const { user: fetchedUser } = await apiMe();
        setCurrentUserId(fetchedUser.id);
        setUser(fetchedUser);
        if (!cached) setStatus('authenticated');
        void backfillUserId(fetchedUser.id);
        await saveUser(fetchedUser);
      } catch {
        if (!cached) await handleUnauthenticated();
      } finally {
        setIsInitialLoading(false);
      }
    })();
  }, [handleUnauthenticated, skipNetworkRefresh]);

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
    isRegistering = true;
    try {
      setStatus('authenticating');
      const device_name = await getDeviceName();
      const response = await apiRegister({ ...payload, device_name });

      if (response.pending) {
        setStatus('unauthenticated');
        return { pending: true };
      }

      const { token, user: registeredUser } = response;
      await setToken(token);
      setCurrentUserId(registeredUser.id);

      if (medicalInfo) {
        const interimId = registeredUser.medical_information?.id;
        try {
          if (interimId == null) {
            throw new Error('Registration response is missing the interim medical_information id');
          }
          const record = await updateMedicalInformation(interimId, medicalInfo);
          await medicalInformationRepo.saveFromServer(record);
        } catch {
          await medicalInformationRepo.saveLocalEdit(medicalInfo, 'pending', registeredUser.id);
        }
        queryClient.invalidateQueries({ queryKey: medicalInformationQueryKey });
      }

      setUser(registeredUser);
      setStatus('authenticated');
      void backfillUserId(registeredUser.id);
      await saveUser(registeredUser);
      return { pending: false };
    } finally {
      isRegistering = false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Best-effort: the user's intent is to log out locally regardless of connectivity.
    }
    await clearPrivateKey();
    await resetDb();
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
    () => ({ status, user, isInitialLoading, login, register, logout, refreshUser }),
    [status, user, isInitialLoading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
