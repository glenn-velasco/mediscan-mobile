import AsyncStorage from '@react-native-async-storage/async-storage';

import { pullSync } from '@/api/endpoints/sync';
import { createMedicalInformation } from '@/api/endpoints/medical-information';
import { pullEmergencyFieldHistory } from '@/api/endpoints/emergency-field-history';
import { getCurrentUserId } from '@/db/context';
import { getIsOffline } from '@/lib/network-state';
import * as medicalInformationRepo from '@/db/repositories/medical-information.repo';
import * as allergiesRepo from '@/db/repositories/allergies.repo';
import * as emergencyHistoryRepo from '@/db/repositories/emergency-field-history.repo';
import {
  hydratePatientChanges,
  pullPatientChanges,
  pushPatientChanges,
  waitForPatientSyncIdle,
} from '@/services/patient-sync.service';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/auth/token-storage', () => ({ getCachedToken: jest.fn(() => 'token') }));
jest.mock('@/lib/network-state', () => ({ getIsOffline: jest.fn(() => true) }));
jest.mock('@/db/context', () => ({
  getCurrentUserId: jest.fn(() => 'patient-1'),
  hasCurrentUser: jest.fn(() => true),
}));
jest.mock('@/lib/backoff', () => ({ backoffDelayMs: jest.fn(() => 1_000) }));
jest.mock('@/lib/query-client', () => ({
  queryClient: { invalidateQueries: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('@/api/endpoints/sync', () => ({ pullSync: jest.fn() }));
jest.mock('@/api/endpoints/emergency-field-history', () => ({
  pullEmergencyFieldHistory: jest.fn().mockResolvedValue([]),
  pushEmergencyFieldHistory: jest.fn(),
}));

jest.mock('@/db/repositories/allergies.repo', () => ({
  getAllForPush: jest.fn().mockResolvedValue([]), hardDelete: jest.fn(), upsertFromServer: jest.fn(),
}));
jest.mock('@/db/repositories/conditions.repo', () => ({
  getAllForPush: jest.fn().mockResolvedValue([]), hardDelete: jest.fn(), upsertFromServer: jest.fn(),
}));
jest.mock('@/db/repositories/diagnoses.repo', () => ({
  getAllForPush: jest.fn().mockResolvedValue([]), hardDelete: jest.fn(), upsertFromServer: jest.fn(),
}));
jest.mock('@/db/repositories/medications.repo', () => ({
  getAllForPush: jest.fn().mockResolvedValue([]), hardDelete: jest.fn(), upsertFromServer: jest.fn(),
}));
jest.mock('@/db/repositories/emergency-contacts.repo', () => ({
  getAllForPush: jest.fn().mockResolvedValue([]), hardDelete: jest.fn(), upsertFromServer: jest.fn(),
}));
jest.mock('@/db/repositories/emergency-field-history.repo', () => ({
  getPending: jest.fn().mockResolvedValue([]),
  cacheServerChanges: jest.fn().mockResolvedValue(0),
  markSynced: jest.fn(),
}));
jest.mock('@/db/repositories/medical-information.repo', () => ({
  getLocal: jest.fn().mockResolvedValue(null),
  getByUserId: jest.fn().mockResolvedValue(null),
  saveFromServer: jest.fn().mockResolvedValue(undefined),
  markSynced: jest.fn(),
  toPayload: jest.fn(),
}));

jest.mock('@/api/endpoints/allergies', () => ({ createAllergy: jest.fn(), updateAllergy: jest.fn(), deleteAllergy: jest.fn() }));
jest.mock('@/api/endpoints/conditions', () => ({ createCondition: jest.fn(), updateCondition: jest.fn(), deleteCondition: jest.fn() }));
jest.mock('@/api/endpoints/diagnoses', () => ({ createDiagnosis: jest.fn(), updateDiagnosis: jest.fn(), deleteDiagnosis: jest.fn() }));
jest.mock('@/api/endpoints/medications', () => ({ createMedication: jest.fn(), updateMedication: jest.fn(), deleteMedication: jest.fn() }));
jest.mock('@/api/endpoints/emergency-contacts', () => ({
  createEmergencyContact: jest.fn(), updateEmergencyContact: jest.fn(), deleteEmergencyContact: jest.fn(),
}));
jest.mock('@/api/endpoints/medical-information', () => ({
  createMedicalInformation: jest.fn(), updateMedicalInformation: jest.fn(),
}));

const mockPullSync = pullSync as jest.Mock;
const mockGetIsOffline = getIsOffline as jest.Mock;
const mockGetCurrentUserId = getCurrentUserId as jest.Mock;
const mockPullEmergencyHistory = pullEmergencyFieldHistory as jest.Mock;
const mockCreateMedicalInformation = createMedicalInformation as jest.Mock;

function syncResponse(
  medicalInformation: Record<string, unknown> | null,
  allergies: Record<string, unknown>[] = [],
  unreadablePeerRecords = 0,
) {
  return {
    server_time: '2026-11-13T00:00:01.000Z',
    medical_information: medicalInformation,
    medical_information_state: medicalInformation ? 'current' : 'missing',
    unreadable_peer_records: unreadablePeerRecords,
    allergies,
    conditions: [],
    diagnoses: [],
    medications: [],
    emergency_contacts: [],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetIsOffline.mockReturnValue(true);
  mockGetCurrentUserId.mockReturnValue('patient-1');
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
  (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
  (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
  (medicalInformationRepo.getLocal as jest.Mock).mockResolvedValue(null);
  (medicalInformationRepo.getByUserId as jest.Mock).mockResolvedValue(null);
  mockPullEmergencyHistory.mockResolvedValue([]);
});

it('propagates a cloud hydration failure instead of reporting a false success', async () => {
  mockPullSync.mockRejectedValue(new Error('profile decrypt failed'));

  await expect(hydratePatientChanges()).rejects.toThrow('profile decrypt failed');
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith('patient_sync_last_synced_at_patient-1');
});

it('forces a full recovery pull despite stale offline state and persists the medical profile', async () => {
  const medical = {
    id: 1, first_name: 'Alice', middle_name: null, last_name: 'Patient', suffix: null,
    dob: '1990-01-01', gender: 'female', blood_type: null, religion: null, national_id: null,
    phone_country_code: null, phone: null, address: null, no_blood_transfusion: false,
    updated_at: '2026-11-13T00:00:00.000Z',
  };
  mockPullSync.mockResolvedValue(syncResponse(medical));

  await expect(hydratePatientChanges()).resolves.toBeUndefined();

  // The best-effort push observes offline and skips, but the explicit recovery pull still runs.
  expect(mockGetIsOffline).toHaveBeenCalled();
  expect(mockPullSync).toHaveBeenCalledWith(undefined);
  expect(medicalInformationRepo.saveFromServer).toHaveBeenCalledWith(medical, 'patient-1');
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(
    'patient_sync_last_synced_at_patient-1',
    '2026-11-13T00:00:01.000Z',
  );
});

it('keeps the previous cursor when an unreadable peer row was skipped', async () => {
  mockPullSync.mockResolvedValue(syncResponse(null, [], 1));

  await expect(hydratePatientChanges()).resolves.toBeUndefined();

  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

it('never writes an older account pull into the newly active account', async () => {
  let resolveFirstPull!: (value: ReturnType<typeof syncResponse>) => void;
  const firstPull = new Promise<ReturnType<typeof syncResponse>>((resolve) => {
    resolveFirstPull = resolve;
  });
  const oldMedical = { id: 1, first_name: 'Old account' };
  const newMedical = { id: 1, first_name: 'New account' };
  const oldAllergy = { id: 'old-allergy', allergen: 'Old', deleted_at: null, updated_at: '2026-11-13T00:00:00Z' };
  const newAllergy = { id: 'new-allergy', allergen: 'New', deleted_at: null, updated_at: '2026-11-13T00:00:00Z' };

  mockGetCurrentUserId.mockReturnValue('patient-old');
  mockPullSync
    .mockImplementationOnce(() => firstPull)
    .mockResolvedValueOnce(syncResponse(newMedical, [newAllergy]));

  const oldPullTask = pullPatientChanges({ force: true });
  await Promise.resolve();
  await Promise.resolve();
  expect(mockPullSync).toHaveBeenCalledTimes(1);

  mockGetCurrentUserId.mockReturnValue('patient-new');
  const newHydrationTask = hydratePatientChanges();
  resolveFirstPull(syncResponse(oldMedical, [oldAllergy]));

  await expect(Promise.all([oldPullTask, newHydrationTask])).resolves.toBeDefined();
  expect(mockPullSync).toHaveBeenCalledTimes(2);
  expect(medicalInformationRepo.saveFromServer).toHaveBeenCalledTimes(1);
  expect(medicalInformationRepo.saveFromServer).toHaveBeenCalledWith(newMedical, 'patient-new');
  expect(allergiesRepo.upsertFromServer).toHaveBeenCalledTimes(1);
  expect(allergiesRepo.upsertFromServer).toHaveBeenCalledWith(newAllergy, 'patient-new');
});

it('waits for a same-user delta pull and then performs a fresh full recovery pull', async () => {
  let resolveDeltaPull!: (value: ReturnType<typeof syncResponse>) => void;
  const deltaPull = new Promise<ReturnType<typeof syncResponse>>((resolve) => {
    resolveDeltaPull = resolve;
  });
  const medical = { id: 1, first_name: 'Recovered' };
  (AsyncStorage.getItem as jest.Mock)
    .mockResolvedValueOnce('old-cursor')
    .mockResolvedValue(null);
  mockPullSync
    .mockImplementationOnce(() => deltaPull)
    .mockResolvedValueOnce(syncResponse(medical));

  const deltaTask = pullPatientChanges({ force: true });
  await Promise.resolve();
  await Promise.resolve();
  expect(mockPullSync).toHaveBeenCalledWith('old-cursor');

  const recoveryTask = hydratePatientChanges();
  resolveDeltaPull(syncResponse(null));
  await expect(Promise.all([deltaTask, recoveryTask])).resolves.toBeDefined();

  expect(mockPullSync).toHaveBeenNthCalledWith(1, 'old-cursor');
  expect(mockPullSync).toHaveBeenNthCalledWith(2, undefined);
  expect(medicalInformationRepo.saveFromServer).toHaveBeenCalledWith(medical, 'patient-1');
});

it('does not cache emergency history after the active account changes', async () => {
  let resolveHistory!: (value: unknown[]) => void;
  const historyRequest = new Promise<unknown[]>((resolve) => {
    resolveHistory = resolve;
  });
  mockGetCurrentUserId.mockReturnValue('history-old');
  mockPullSync.mockResolvedValue(syncResponse(null));
  mockPullEmergencyHistory.mockImplementationOnce(() => historyRequest);

  const pullTask = pullPatientChanges({ force: true });
  for (let index = 0; index < 10 && mockPullEmergencyHistory.mock.calls.length === 0; index += 1) {
    await Promise.resolve();
  }
  expect(mockPullEmergencyHistory).toHaveBeenCalledTimes(1);

  mockGetCurrentUserId.mockReturnValue('history-new');
  resolveHistory([{ id: 'event-old' }]);
  await expect(pullTask).resolves.toBeUndefined();

  expect(emergencyHistoryRepo.cacheServerChanges).not.toHaveBeenCalled();
});

it('does not mark an old account medical row synced after an account switch', async () => {
  let resolveCreate!: () => void;
  const createRequest = new Promise<void>((resolve) => {
    resolveCreate = resolve;
  });
  mockGetIsOffline.mockReturnValue(false);
  mockGetCurrentUserId.mockReturnValue('push-old');
  (medicalInformationRepo.getByUserId as jest.Mock).mockResolvedValue({
    server_id: null,
    sync_status: 'pending',
  });
  (medicalInformationRepo.toPayload as jest.Mock).mockReturnValue({ first_name: 'Old' });
  mockCreateMedicalInformation.mockImplementationOnce(() => createRequest);

  const pushTask = pushPatientChanges();
  for (let index = 0; index < 10 && mockCreateMedicalInformation.mock.calls.length === 0; index += 1) {
    await Promise.resolve();
  }
  expect(mockCreateMedicalInformation).toHaveBeenCalledTimes(1);

  mockGetCurrentUserId.mockReturnValue('push-new');
  resolveCreate();
  await expect(pushTask).resolves.toBeUndefined();

  expect(medicalInformationRepo.markSynced).not.toHaveBeenCalled();
});

it('bounds the auth-transition wait when an active push stalls', async () => {
  jest.useFakeTimers();
  let resolveCreate!: () => void;
  const createRequest = new Promise<void>((resolve) => {
    resolveCreate = resolve;
  });
  mockGetIsOffline.mockReturnValue(false);
  mockGetCurrentUserId.mockReturnValue('patient-stalled');
  (medicalInformationRepo.getByUserId as jest.Mock).mockResolvedValue({
    server_id: null,
    sync_status: 'pending',
  });
  (medicalInformationRepo.toPayload as jest.Mock).mockReturnValue({ first_name: 'Stalled' });
  mockCreateMedicalInformation.mockImplementationOnce(() => createRequest);

  const pushTask = pushPatientChanges();
  for (let index = 0; index < 10 && mockCreateMedicalInformation.mock.calls.length === 0; index += 1) {
    await Promise.resolve();
  }

  const idleTask = waitForPatientSyncIdle(100);
  jest.advanceTimersByTime(100);
  await expect(idleTask).resolves.toBeUndefined();

  resolveCreate();
  await pushTask;
  jest.useRealTimers();
});
