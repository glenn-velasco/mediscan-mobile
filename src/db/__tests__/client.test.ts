/* eslint-disable @typescript-eslint/no-require-imports -- resetModules needs a fresh CommonJS import */
const mockOpenDatabaseAsync = jest.fn();
const mockDeleteDatabaseAsync = jest.fn();
const mockRunMigrations = jest.fn();
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

type TestGlobal = typeof globalThis & {
  __EXPO_SQLITE_RELEASE_WEB_WORKER__?: jest.Mock<Promise<void>, []>;
};

function setVisibilityState(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
}

function installWebEnvironment(): void {
  const fakeDocument = new EventTarget();
  const fakeWindow = new EventTarget();
  Object.defineProperty(globalThis, 'document', { configurable: true, value: fakeDocument });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: fakeWindow });
  setVisibilityState('visible');
}

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: (...args: unknown[]) => mockOpenDatabaseAsync(...args),
  deleteDatabaseAsync: (...args: unknown[]) => mockDeleteDatabaseAsync(...args),
}));

jest.mock('@/db/migrations', () => ({
  runMigrations: (...args: unknown[]) => mockRunMigrations(...args),
}));

type MockDb = {
  execAsync: jest.Mock;
  closeAsync: jest.Mock;
};

function createDb(): MockDb {
  return {
    execAsync: jest.fn().mockResolvedValue(undefined),
    closeAsync: jest.fn().mockResolvedValue(undefined),
  };
}

describe('database client lifecycle', () => {
  beforeEach(() => {
    installWebEnvironment();
    jest.resetModules();
    mockOpenDatabaseAsync.mockReset();
    mockDeleteDatabaseAsync.mockReset().mockResolvedValue(undefined);
    mockRunMigrations.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    delete (globalThis as TestGlobal).__EXPO_SQLITE_RELEASE_WEB_WORKER__;
  });

  afterAll(() => {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else delete (globalThis as { document?: unknown }).document;
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else delete (globalThis as { window?: unknown }).window;
  });

  it('does not open SQLite merely by importing the client', () => {
    jest.isolateModules(() => {
      require('@/db/client');
    });

    expect(mockOpenDatabaseAsync).not.toHaveBeenCalled();
  });

  it('shares one database initialization across concurrent callers', async () => {
    const db = createDb();
    mockOpenDatabaseAsync.mockResolvedValue(db);
    const { getDb } = require('@/db/client') as typeof import('@/db/client');

    const first = getDb();
    const second = getDb();

    expect(first).toBe(second);
    await expect(first).resolves.toBe(db);
    expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(1);
    expect(mockRunMigrations).toHaveBeenCalledTimes(1);
  });

  it('recovers from a transient web OPFS ownership conflict', async () => {
    const db = createDb();
    mockOpenDatabaseAsync
      .mockRejectedValueOnce(new DOMException('Access handle is already open', 'NoModificationAllowedError'))
      .mockResolvedValueOnce(db);
    const { getDb } = require('@/db/client') as typeof import('@/db/client');

    await expect(getDb()).resolves.toBe(db);
    expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(2);
  });

  it('retries when Expo SQLite reports a recoverable invalid VFS state', async () => {
    const db = createDb();
    mockOpenDatabaseAsync
      .mockRejectedValueOnce(new Error('Error: Invalid VFS state'))
      .mockResolvedValueOnce(db);
    const { getDb } = require('@/db/client') as typeof import('@/db/client');

    await expect(getDb()).resolves.toBe(db);
    expect(mockOpenDatabaseAsync).toHaveBeenCalledTimes(2);
  });

  it('closes a database whose migration fails and permits a clean retry', async () => {
    const failedDb = createDb();
    const recoveredDb = createDb();
    mockOpenDatabaseAsync.mockResolvedValueOnce(failedDb).mockResolvedValueOnce(recoveredDb);
    mockRunMigrations.mockRejectedValueOnce(new Error('migration failed')).mockResolvedValueOnce(undefined);
    const { getDb } = require('@/db/client') as typeof import('@/db/client');

    await expect(getDb()).rejects.toThrow('migration failed');
    expect(failedDb.closeAsync).toHaveBeenCalledTimes(1);
    await expect(getDb()).resolves.toBe(recoveredDb);
  });

  it('releases the database, worker, and ownership lock when the web tab becomes hidden', async () => {
    const db = createDb();
    const releaseWorker = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
    const request = jest.fn((_name, _options, callback: () => Promise<void>) => callback());
    Object.defineProperty(navigator, 'locks', {
      configurable: true,
      value: { request },
    });
    (globalThis as TestGlobal).__EXPO_SQLITE_RELEASE_WEB_WORKER__ = releaseWorker;
    mockOpenDatabaseAsync.mockResolvedValue(db);
    const { getDb } = require('@/db/client') as typeof import('@/db/client');

    await expect(getDb()).resolves.toBe(db);
    expect(request).toHaveBeenCalledWith(
      'mediscan-sqlite-owner',
      expect.objectContaining({ mode: 'exclusive' }),
      expect.any(Function),
    );

    setVisibilityState('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise<void>((resolve) => setTimeout(resolve, 0));

    expect(db.closeAsync).toHaveBeenCalled();
    expect(releaseWorker).toHaveBeenCalled();
  });
});
