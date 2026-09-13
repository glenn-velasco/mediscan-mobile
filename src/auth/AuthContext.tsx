import NetInfo from '@react-native-community/netinfo';
import { createContext, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

import { login as apiLogin, logout as apiLogout, me as apiMe, register as apiRegister } from '@/api/endpoints/auth';
import { updateMedicalInformation } from '@/api/endpoints/medical-information';
import type { LoginPayload, MedicalInformationPayload, RegisterPayload, User } from '@/api/types';
import { getDeviceName } from '@/auth/device-name';
import { clearToken, setToken } from '@/auth/token-storage';
import { clearUser, loadUser, saveUser } from '@/auth/user-storage';
import { setCurrentUserId } from '@/db/context';
import * as medicalInformationRepo from '@/db/repositories/medical-information.repo';
import { queryClient, queryPersister } from '@/lib/query-client';
import { medicalInformationQueryKey } from '@/lib/query-keys';
import { clearPrivateKey } from '@/services/device-key-storage';
import { clearLastSyncedAt, forcePushBeforeLogout } from '@/services/patient-sync.service';
import { resetPendingSyncBackoff } from '@/services/pending-sync.service';
import { forceSyncBeforeLogout } from '@/services/verification-sync.service';
import { useAvatarStore } from '@/stores/avatar-store';
import { supabase } from '@/lib/supabase';

type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'unauthenticated';

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

// react-doctor-disable-next-line react-doctor/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null);

async function backfillUserId(userId: string | number): Promise<void> {
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
    queryClient.clear();
    await clearPrivateKey();
    setCurrentUserId(null);
    await clearToken();
    resetPendingSyncBackoff();
    useAvatarStore.getState().clear();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.access_token) void setToken(session.access_token);
      if (event === 'SIGNED_OUT') void handleUnauthenticated();
    });
    return () => listener.subscription.unsubscribe();
  }, [handleUnauthenticated]);

  // react-doctor-disable-next-line react-hooks-js/no-set-state-after-await-in-effect, react-doctor/no-set-state-after-await-in-effect
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token ?? null;
      if (token) await setToken(token);
      if (cancelled) return;
      if (!token) {
        console.log('[Auth] boot: no token → unauthenticated');
        setStatus('unauthenticated');
        setIsInitialLoading(false);
        return;
      }

      const cached = await loadUser();
      if (cancelled) return;
      console.log('[Auth] boot: token found, cached user:', !!cached);

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
        setIsInitialLoading(false);
        void backfillUserId(cached.id);
      }

      const network = await NetInfo.fetch();
      const isOnline = network.isInternetReachable ?? network.isConnected ?? false;
      // react-doctor-disable-next-line react-hooks-js/todo
      if (!isOnline) {
        if (!cached) {
          await handleUnauthenticated();
          setIsInitialLoading(false);
        }
        return;
      }
      // react-doctor-disable-next-line react-hooks-js/todo
      try {
        const ME_TIMEOUT_MS = 10_000;
        const { user: fetchedUser } = await Promise.race([
          apiMe(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('apiMe timeout')), ME_TIMEOUT_MS)),
        ]);
        if (cancelled) return;
        console.log('[Auth] boot: apiMe resolved, user:', fetchedUser.id);
        setCurrentUserId(fetchedUser.id);
        setUser(fetchedUser);
        if (!cached) {
          console.log('[Auth] boot: no cache → setting authenticated');
          setStatus('authenticated');
          setIsInitialLoading(false);
        }
        void backfillUserId(fetchedUser.id);
        await saveUser(fetchedUser);
      } catch (err) {
        console.error('[Auth] boot: apiMe failed:', err);
        if (!cancelled && !cached) {
          await handleUnauthenticated();
          setIsInitialLoading(false);
        }
      } finally {
        if (!cancelled && !cached) setIsInitialLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [handleUnauthenticated, skipNetworkRefresh]);

  const login = useCallback(async (payload: Omit<LoginPayload, 'device_name'>) => {
    setStatus('authenticating');
    const device_name = await getDeviceName();
    const { token, user: loggedInUser } = await apiLogin({ ...payload, device_name });
    await setToken(token);
    setCurrentUserId(loggedInUser.id);
    setUser(loggedInUser);
    setStatus('authenticated');
    setIsInitialLoading(false);
    void backfillUserId(loggedInUser.id);
    await saveUser(loggedInUser);
  }, []);

  const register = useCallback(async (payload: Omit<RegisterPayload, 'device_name'>, medicalInfo?: MedicalInformationPayload) => {
    // react-doctor-disable-next-line react-hooks-js/todo
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

      const persistMedicalInfo = async () => {
        if (!medicalInfo) return;
        const interimId = registeredUser.medical_information?.id;
        try {
          if (interimId == null) {
            await medicalInformationRepo.saveLocalEdit(medicalInfo, 'pending', registeredUser.id);
          } else {
            const record = await updateMedicalInformation(interimId, medicalInfo);
            await medicalInformationRepo.saveFromServer(record);
          }
        } catch {
          await medicalInformationRepo.saveLocalEdit(medicalInfo, 'pending', registeredUser.id);
        }
        queryClient.invalidateQueries({ queryKey: medicalInformationQueryKey });
      };

      await Promise.all([persistMedicalInfo(), saveUser(registeredUser)]);

      setUser(registeredUser);
      setStatus('authenticated');
      setIsInitialLoading(false);
      void backfillUserId(registeredUser.id);
      return { pending: false };
    } catch (err) {
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    // Flush all pending data before clearing auth — allergies, conditions, diagnoses,
    // medications, emergency contacts, medical information, and verification toggles.
    // If the server is unreachable, pending changes stay in the local DB and will sync
    // on next login via the sync triggers (offline-first architecture).
    const SYNC_TIMEOUT_MS = 15_000;
    try {
      await Promise.race([
        Promise.all([
          forcePushBeforeLogout(),
          forceSyncBeforeLogout(),
        ]),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('sync timeout')), SYNC_TIMEOUT_MS)),
      ]);
    } catch {
      // Best-effort: some data may not have synced if the server is unreachable.
    }

    const LOGOUT_TIMEOUT_MS = 5_000;
    try {
      await Promise.race([
        apiLogout(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('logout timeout')), LOGOUT_TIMEOUT_MS)),
      ]);
    } catch {
      // Best-effort: the user's intent is to log out locally regardless of connectivity.
    }

    await clearPrivateKey();
    await clearLastSyncedAt();
    setCurrentUserId(null);
    queryClient.clear();
    await queryPersister.removeClient();
    await clearToken();
    await clearUser();
    resetPendingSyncBackoff();
    useAvatarStore.getState().clear();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const refreshUser = useCallback(async () => {
    const network = await NetInfo.fetch();
    if (!(network.isInternetReachable ?? network.isConnected ?? false)) return;
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
