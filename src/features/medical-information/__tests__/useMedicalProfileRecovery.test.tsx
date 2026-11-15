import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useEffect } from 'react';

import { useMedicalProfileRecovery } from '@/features/medical-information/useMedicalProfileRecovery';
import { hydratePatientChanges } from '@/services/patient-sync.service';

jest.mock('@/services/patient-sync.service', () => ({
  hydratePatientChanges: jest.fn(),
}));

const mockHydrate = hydratePatientChanges as jest.Mock;

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const baseOptions = {
  userId: 'patient-1',
  hasProfile: false,
  storageState: 'current' as const,
  isLocalLoading: false,
  isStorageStateLoading: false,
  isStorageStateError: false,
};

type HookOptions = Parameters<typeof useMedicalProfileRecovery>[0];
type HookResult = ReturnType<typeof useMedicalProfileRecovery>;
let latest: HookResult;

function captureResult(result: HookResult) {
  latest = result;
}

function Harness({ options }: { options: HookOptions }) {
  const result = useMedicalProfileRecovery(options);
  useEffect(() => captureResult(result), [result]);
  return null;
}

async function renderRecoveryHook(options: HookOptions) {
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(<Harness options={options} />);
  });
  await act(async () => {
    jest.advanceTimersByTime(0);
    await Promise.resolve();
  });
  return renderer;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

it('automatically recovers a current cloud profile while keeping a loading state', async () => {
  const hydration = deferred();
  const refetchLocalProfile = jest.fn().mockResolvedValue(undefined);
  mockHydrate.mockReturnValue(hydration.promise);
  const renderer = await renderRecoveryHook({ ...baseOptions, refetchLocalProfile });

  expect(mockHydrate).toHaveBeenCalledTimes(1);
  expect(latest.isRecoveringProfile).toBe(true);
  expect(latest.shouldAutomaticallyRecoverProfile).toBe(false);

  await act(async () => hydration.resolve());
  expect(latest.isRecoveringProfile).toBe(false);
  expect(refetchLocalProfile).toHaveBeenCalledTimes(1);
  expect(mockHydrate).toHaveBeenCalledTimes(1);
  await act(async () => renderer.unmount());
});

it.each(['missing', 'legacy'] as const)(
  'does not recover or create a profile when cloud state is %s',
  async (storageState) => {
    const renderer = await renderRecoveryHook({
      ...baseOptions,
      storageState,
      refetchLocalProfile: jest.fn(),
    });

    expect(latest.shouldAutomaticallyRecoverProfile).toBe(false);
    expect(latest.isRecoveringProfile).toBe(false);
    expect(mockHydrate).not.toHaveBeenCalled();
    await act(async () => renderer.unmount());
  },
);

it('ends neutral loading after failure and allows a manual retry', async () => {
  mockHydrate.mockRejectedValueOnce(new Error('temporary failure')).mockResolvedValueOnce(undefined);
  const refetchLocalProfile = jest.fn().mockResolvedValue(undefined);
  const renderer = await renderRecoveryHook({ ...baseOptions, refetchLocalProfile });

  expect(mockHydrate).toHaveBeenCalledTimes(1);
  expect(latest.isRecoveringProfile).toBe(false);

  await act(async () => latest.recoverMedicalProfile());
  expect(mockHydrate).toHaveBeenCalledTimes(2);
  expect(refetchLocalProfile).toHaveBeenCalledTimes(1);
  await act(async () => renderer.unmount());
});

it('ignores stale completion after switching accounts', async () => {
  const oldHydration = deferred();
  const newHydration = deferred();
  mockHydrate
    .mockReturnValueOnce(oldHydration.promise)
    .mockReturnValueOnce(newHydration.promise);
  const refetchLocalProfile = jest.fn().mockResolvedValue(undefined);
  const renderer = await renderRecoveryHook({
    ...baseOptions,
    userId: 'patient-old',
    refetchLocalProfile,
  });

  await act(async () => {
    renderer.update(<Harness options={{
      ...baseOptions,
      userId: 'patient-new',
      refetchLocalProfile,
    }} />);
  });
  await act(async () => {
    jest.advanceTimersByTime(0);
    await Promise.resolve();
  });
  expect(mockHydrate).toHaveBeenCalledTimes(2);

  await act(async () => oldHydration.resolve());
  expect(latest.isRecoveringProfile).toBe(true);

  await act(async () => newHydration.resolve());
  expect(latest.isRecoveringProfile).toBe(false);
  await act(async () => renderer.unmount());
});

it('ends neutral loading when cloud hydration stalls', async () => {
  mockHydrate.mockReturnValue(new Promise<void>(() => {}));
  const renderer = await renderRecoveryHook({
    ...baseOptions,
    refetchLocalProfile: jest.fn(),
  });
  expect(latest.isRecoveringProfile).toBe(true);

  await act(async () => {
    jest.advanceTimersByTime(15_000);
    await Promise.resolve();
  });

  expect(latest.isRecoveringProfile).toBe(false);
  await act(async () => renderer.unmount());
});
