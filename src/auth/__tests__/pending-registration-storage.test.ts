import * as SecureStore from 'expo-secure-store';

import type { MedicalInformationPayload } from '@/api/types';
import {
  clearPendingRegistration,
  loadPendingRegistration,
  savePendingRegistration,
} from '@/auth/pending-registration-storage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const getItemAsync = SecureStore.getItemAsync as jest.Mock;
const setItemAsync = SecureStore.setItemAsync as jest.Mock;
const deleteItemAsync = SecureStore.deleteItemAsync as jest.Mock;

const medicalInfo: MedicalInformationPayload = {
  email: 'patient@example.com',
  first_name: 'Pat',
  last_name: 'Ient',
  blood_type: 'o_positive',
  religion: 'catholic',
  no_blood_transfusion: true,
};

beforeEach(() => {
  jest.clearAllMocks();
});

it('stores a pending email-confirmation registration in SecureStore', async () => {
  await savePendingRegistration(' Patient@Example.com ', medicalInfo);

  expect(setItemAsync).toHaveBeenCalledWith(
    'mediscan_pending_registration',
    JSON.stringify({ email: 'patient@example.com', medicalInfo }),
  );
});

it('returns the draft only for the matching authenticated email', async () => {
  getItemAsync.mockResolvedValue(JSON.stringify({ email: 'patient@example.com', medicalInfo }));

  await expect(loadPendingRegistration('PATIENT@example.com')).resolves.toEqual(medicalInfo);
  await expect(loadPendingRegistration('someone@example.com')).resolves.toBeNull();
});

it('clears an unreadable draft instead of blocking login hydration', async () => {
  getItemAsync.mockResolvedValue('{broken');

  await expect(loadPendingRegistration('patient@example.com')).resolves.toBeNull();
  expect(deleteItemAsync).toHaveBeenCalledWith('mediscan_pending_registration');
});

it('can clear a consumed registration draft', async () => {
  await clearPendingRegistration();
  expect(deleteItemAsync).toHaveBeenCalledWith('mediscan_pending_registration');
});
