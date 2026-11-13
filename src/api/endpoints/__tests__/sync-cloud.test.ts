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

beforeEach(() => {
  rpc.mockReset();
  open.mockReset();
  migrateLegacy.mockReset();
  decryptLegacy.mockReset();
});

it('decrypts all current rows in one batch and ignores unreadable development rows', async () => {
  rpc.mockResolvedValue({ error: null, data: {
    server_time: '2026-09-14T00:00:00Z',
    medical_information: { encrypted_payload: 'gcm1:medical', updated_at: '2026-09-14T00:00:00Z' },
    allergies: [
      { id: 'a', encrypted_payload: 'gcm1:allergy', deleted_at: null, updated_at: '2026-09-14T00:00:00Z' },
      { id: 'legacy', encrypted_payload: 'iv:old', deleted_at: null, updated_at: '2026-09-14T00:00:00Z' },
    ],
    conditions: [], diagnoses: [], medications: [], emergency_contacts: [],
  } });
  open.mockResolvedValue([{ first_name: 'Alice' }, { allergen: 'Peanut' }]);

  const result = await pullSync();
  expect(open).toHaveBeenCalledTimes(1);
  expect(open).toHaveBeenCalledWith(['gcm1:medical', 'gcm1:allergy']);
  expect(result.medical_information).toMatchObject({ first_name: 'Alice' });
  expect(result.medical_information_state).toBe('current');
  expect(result.allergies).toEqual([expect.objectContaining({ id: 'a', allergen: 'Peanut' })]);
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
