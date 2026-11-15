import NetInfo from '@react-native-community/netinfo';
import { act, create } from 'react-test-renderer';
import { useContext, useEffect } from 'react';

import { AuthContext, AuthProvider } from '@/auth/AuthContext';
import { loadToken, setToken, clearToken } from '@/auth/token-storage';
import { loadUser, clearUser } from '@/auth/user-storage';
import { supabase } from '@/lib/supabase';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
}));

jest.mock('@/auth/token-storage', () => ({
  loadToken: jest.fn(),
  setToken: jest.fn().mockResolvedValue(undefined),
  clearToken: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/auth/user-storage', () => ({
  loadUser: jest.fn(),
  saveUser: jest.fn().mockResolvedValue(undefined),
  clearUser: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/auth/pending-registration-storage', () => ({
  clearPendingRegistration: jest.fn(),
  loadPendingRegistration: jest.fn().mockResolvedValue(null),
  savePendingRegistration: jest.fn(),
}));

jest.mock('@/db/context', () => ({
  setCurrentUserId: jest.fn(),
}));

jest.mock('@/db/client', () => ({
  getDb: jest.fn(),
}));

jest.mock('@/db/repositories/medical-information.repo', () => ({
  saveLocalEdit: jest.fn(),
  saveFromServer: jest.fn(),
}));

jest.mock('@/lib/query-client', () => ({
  queryClient: { clear: jest.fn() },
  queryPersister: { removeClient: jest.fn().mockResolvedValue(undefined) },
}));

jest.mock('@/services/device-key-storage', () => ({
  clearPrivateKey: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/patient-sync.service', () => ({
  clearLastSyncedAt: jest.fn().mockResolvedValue(undefined),
  forcePushBeforeLogout: jest.fn().mockResolvedValue(undefined),
  hydratePatientChanges: jest.fn().mockResolvedValue(undefined),
  resetPatientSyncBackoff: jest.fn(),
  waitForPatientSyncIdle: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/services/pending-sync.service', () => ({
  resetPendingSyncBackoff: jest.fn(),
}));

jest.mock('@/services/verification-sync.service', () => ({
  forceSyncBeforeLogout: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/stores/avatar-store', () => ({
  useAvatarStore: { getState: () => ({ clear: jest.fn() }) },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
      getSession: jest.fn(),
    },
  },
}));

const mockGetSession = supabase.auth.getSession as jest.Mock;
const mockLoadToken = loadToken as jest.Mock;
const mockLoadUser = loadUser as jest.Mock;
const mockNetInfoFetch = NetInfo.fetch as jest.Mock;
const mockSetToken = setToken as jest.Mock;
const mockClearToken = clearToken as jest.Mock;
const mockClearUser = clearUser as jest.Mock;

describe('AuthProvider offline cold-start recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps the user authenticated offline even when supabase.auth.getSession returns null after JWT expiry', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null }, error: new Error('Network request failed') });
    mockLoadToken.mockResolvedValue('cached-jwt-token');
    mockLoadUser.mockResolvedValue({
      id: 'user-123',
      email: 'patient@example.com',
      fullname: 'Juan Dela Cruz',
    });
    mockNetInfoFetch.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });

    let latestStatus: string | undefined;
    let latestUserId: string | number | undefined;

    function Consumer() {
      const ctx = useContext(AuthContext);
      useEffect(() => {
        latestStatus = ctx?.status;
        latestUserId = ctx?.user?.id;
      }, [ctx?.status, ctx?.user]);
      return null;
    }

    await act(async () => {
      create(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      );
    });

    expect(mockLoadToken).toHaveBeenCalledTimes(1);
    expect(mockSetToken).not.toHaveBeenCalled();
    expect(mockClearToken).not.toHaveBeenCalled();
    expect(mockClearUser).not.toHaveBeenCalled();
    expect(latestStatus).toBe('authenticated');
    expect(latestUserId).toBe('user-123');
  });
});
