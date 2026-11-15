/* eslint-disable @typescript-eslint/no-require-imports -- resetModules needs a fresh CommonJS import */
const mockGetLocal = jest.fn().mockResolvedValue(null);

jest.mock('@/db/repositories/medical-information.repo', () => ({
  getLocal: () => mockGetLocal(),
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: null,
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
  downloadAsync: jest.fn(),
}));
jest.mock('@/api/endpoints/medical-information', () => ({
  getMedicalInformation: jest.fn(),
}));
jest.mock('@/auth/token-storage', () => ({ getCachedToken: () => null }));
jest.mock('@/lib/network-state', () => ({
  getIsOffline: () => false,
  isNetworkStateKnown: () => false,
}));

describe('avatar store database lifecycle', () => {
  beforeEach(() => {
    jest.resetModules();
    mockGetLocal.mockClear();
  });

  it('does not read SQLite merely because AuthContext imports the store', () => {
    jest.isolateModules(() => {
      require('@/stores/avatar-store');
    });

    expect(mockGetLocal).not.toHaveBeenCalled();
  });

  it('reads SQLite lazily when the authenticated app initializes the store', async () => {
    const { useAvatarStore } = require('@/stores/avatar-store') as typeof import('@/stores/avatar-store');

    await useAvatarStore.getState().init();

    expect(mockGetLocal).toHaveBeenCalledTimes(1);
  });
});
