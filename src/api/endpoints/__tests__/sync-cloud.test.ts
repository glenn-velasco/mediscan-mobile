import { pullSync } from '@/api/endpoints/sync';
import { migrateLegacyMedicalInformation, openPatientPayloads } from '@/api/patient-cloud-crypto';
import { supabase } from '@/api/supabase';
import { decryptJson } from '@/lib/crypto';

jest.mock('@/api/supabase', () => ({
  requireAuthUserId: jest.fn().mockResolvedValue('patient-1'),
  supabase: { rpc: jest.fn() },
  throwSupabaseError: jest.fn((error) => { throw error; }),
}));
jest.mock('@/api/patient-cloud-crypto', () => ({
  migrateLegacyMedicalInformation: jest.fn(),
  openPatientPayloads: jest.fn(),
}));
jest.mock('@/lib/crypto', () => ({ decryptJson: jest.fn() }));

const rpc = supabase.rpc as jest.Mock;
const open = openPatientPayloads as jest.Mock;
const migrateLegacy = migrateLegacyMedicalInformation as jest.Mock;
const decryptLegacy = decryptJson as jest.Mock;
const currentMedicalPayload = {
  first_name: 'Alice', middle_name: null, last_name: 'Patient', suffix: null,
  dob: '1990-01-01', gender: 'female', phone_country_code: 'PH', phone: '9123456789',
  blood_type: 'o_positive', religion: 'catholic', address: null, no_blood_transfusion: false,
};

beforeEach(() => {
  rpc.mockReset();
  open.mockReset();
  migrateLegacy.mockReset();
  decryptLegacy.mockReset();
});

it('hydrates a valid medical profile even when a peer row is unreadable', async () => {
  rpc.mockResolvedValue({ error: null, data: {
    server_time: '2026-09-14T00:00:00Z',
    medical_information: { encrypted_payload: 'gcm1:medical', updated_at: '2026-09-14T00:00:00Z' },
    allergies: [
      { id: 'a', encrypted_payload: 'gcm1:allergy', deleted_at: null, updated_at: '2026-09-14T00:00:00Z' },
      { id: 'broken', encrypted_payload: 'gcm1:broken', deleted_at: null, updated_at: '2026-09-14T00:00:00Z' },
      { id: 'legacy', encrypted_payload: 'iv:old', deleted_at: null, updated_at: '2026-09-14T00:00:00Z' },
    ],
    conditions: [
      { id: 'deleted', encrypted_payload: 'gcm1:deleted', deleted_at: '2026-09-14T00:00:00Z', updated_at: '2026-09-14T00:00:00Z' },
    ],
    diagnoses: [], medications: [], emergency_contacts: [],
  } });
  open.mockImplementation(async (ciphertexts: string[]) => {
    if (ciphertexts.length === 1 && ciphertexts[0] === 'gcm1:medical') return [currentMedicalPayload];
    if (ciphertexts.length === 1 && ciphertexts[0] === 'gcm1:allergy') return [{ allergen: 'Peanut' }];
    throw Object.assign(new Error('Invalid patient record (HTTP 400)'), { status: 400 });
  });

  const result = await pullSync();
  expect(open).toHaveBeenNthCalledWith(1, ['gcm1:medical']);
  expect(open).toHaveBeenCalledWith(['gcm1:allergy', 'gcm1:broken']);
  expect(open).not.toHaveBeenCalledWith(expect.arrayContaining(['gcm1:deleted']));
  expect(result.medical_information).toMatchObject({ first_name: 'Alice' });
  expect(result.medical_information_state).toBe('current');
  expect(result.unreadable_peer_records).toBe(1);
  expect(result.allergies).toEqual([expect.objectContaining({ id: 'a', allergen: 'Peanut' })]);
  expect(result.conditions).toEqual([expect.objectContaining({ id: 'deleted', deleted_at: '2026-09-14T00:00:00Z' })]);
});

it.each([
  ['network failure', new Error('Network request failed')],
  ['authentication failure', Object.assign(new Error('Invalid session (HTTP 401)'), { status: 401 })],
  ['service failure', Object.assign(new Error('Service unavailable (HTTP 503)'), { status: 503 })],
  ['global crypto failure', Object.assign(new Error('Emergency history encryption is not configured (HTTP 400)'), { status: 400 })],
])('propagates a %s instead of classifying every peer as unreadable', async (_label, failure) => {
  rpc.mockResolvedValue({ error: null, data: {
    server_time: '2026-09-14T00:00:00Z',
    medical_information: { encrypted_payload: 'gcm1:medical', updated_at: '2026-09-14T00:00:00Z' },
    allergies: [
      { id: 'a', encrypted_payload: 'gcm1:allergy', deleted_at: null, updated_at: '2026-09-14T00:00:00Z' },
    ],
    conditions: [], diagnoses: [], medications: [], emergency_contacts: [],
  } });
  open.mockImplementation(async (ciphertexts: string[]) => {
    if (ciphertexts[0] === 'gcm1:medical') return [currentMedicalPayload];
    throw failure;
  });

  await expect(pullSync()).rejects.toBe(failure);
  expect(open).toHaveBeenCalledTimes(2);
});

it('rejects when the medical profile itself cannot be decrypted', async () => {
  rpc.mockResolvedValue({ error: null, data: {
    server_time: '2026-09-14T00:00:00Z',
    medical_information: { encrypted_payload: 'gcm1:medical', updated_at: '2026-09-14T00:00:00Z' },
    allergies: [
      { id: 'a', encrypted_payload: 'gcm1:allergy', deleted_at: null, updated_at: '2026-09-14T00:00:00Z' },
    ],
    conditions: [], diagnoses: [], medications: [], emergency_contacts: [],
  } });
  open.mockRejectedValue(new Error('medical ciphertext is unreadable'));

  await expect(pullSync()).rejects.toThrow('medical ciphertext is unreadable');
  expect(open).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledWith(['gcm1:medical']);
});

it('recovers and upgrades a legacy medical profile when this device has the original key', async () => {
  const legacyPayload = {
    first_name: 'Glenn', middle_name: 'Luis', last_name: 'Velasco', suffix: null,
    dob: '1990-01-01', gender: 'male', phone_country_code: 'PH', phone: '9123456789',
    blood_type: 'o_positive', religion: 'catholic', address: null, no_blood_transfusion: false,
  };
  rpc.mockResolvedValue({ error: null, data: {
    server_time: '2026-11-13T00:00:00Z',
    medical_information: { encrypted_payload: 'legacy-iv:ciphertext', updated_at: '2026-11-01T00:00:00Z' },
    allergies: [], conditions: [], diagnoses: [], medications: [], emergency_contacts: [],
  } });
  decryptLegacy.mockResolvedValue(legacyPayload);
  migrateLegacy.mockResolvedValue(undefined);

  const result = await pullSync();

  expect(result.medical_information).toMatchObject({ first_name: 'Glenn', blood_type: 'o_positive' });
  expect(result.medical_information_state).toBe('legacy-recovered');
  expect(migrateLegacy).toHaveBeenCalledWith('legacy-iv:ciphertext', legacyPayload);
});

it('does not treat an existing legacy profile as a missing profile on a different device', async () => {
  rpc.mockResolvedValue({ error: null, data: {
    server_time: '2026-11-13T00:00:00Z',
    medical_information: { encrypted_payload: 'legacy-iv:ciphertext', updated_at: '2026-11-01T00:00:00Z' },
    allergies: [], conditions: [], diagnoses: [], medications: [], emergency_contacts: [],
  } });
  decryptLegacy.mockRejectedValue(new Error('wrong device key'));

  const result = await pullSync();

  expect(result.medical_information).toBeNull();
  expect(result.medical_information_state).toBe('legacy-unavailable');
  expect(migrateLegacy).not.toHaveBeenCalled();
});
