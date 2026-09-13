import { buildEmergencyQrV2, parseEmergencyQrV2 } from '@/lib/emergency-qr-v2';
import { DEFAULT_EMERGENCY_DISCLOSURE } from '@/types/emergency';
import type { AllergyRow, MedicalInformationRow } from '@/db/schema';

jest.mock('react-native-libsodium', () => {
  const sodium = require('libsodium-wrappers');
  return { __esModule: true, default: sodium, ready: sodium.ready };
});

const mockSecureValues = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: (key: string) => Promise.resolve(mockSecureValues.get(key) ?? null),
  setItemAsync: (key: string, value: string) => { mockSecureValues.set(key, value); return Promise.resolve(); },
  deleteItemAsync: (key: string) => { mockSecureValues.delete(key); return Promise.resolve(); },
}));

const medical = {
  user_id: 7,
  server_id: 7,
  email: 'patient@example.com',
  full_name: 'Sample Patient',
  first_name: 'Sample',
  middle_name: null,
  last_name: 'Patient',
  suffix: null,
  date_of_birth: '1990-01-01',
  gender: 'female',
  phone_country_code: '63',
  phone: '9123456789',
  blood_type: 'o_positive',
  religion: null,
  address: JSON.stringify({ street: 'Private address', city: 'Cebu' }),
  no_blood_transfusion: 1,
  sync_status: 'synced',
  updated_at_local: new Date().toISOString(),
  server_updated_at: null,
} as MedicalInformationRow;

const allergy = {
  local_uuid: 'a1', user_id: 7, server_id: 1, allergen: 'Peanuts', reaction: 'Anaphylaxis', severity: 'life-threatening',
  verified_by: null, sync_status: 'synced', deleted_locally: 0, updated_at_local: new Date().toISOString(),
} as AllergyRow;

describe('emergency QR v2', () => {
  it('round-trips a signed minimum-disclosure payload', async () => {
    const encoded = await buildEmergencyQrV2({ patientId: 7, medical, allergies: [allergy], conditions: [], diagnoses: [], medications: [], contacts: [], disclosure: DEFAULT_EMERGENCY_DISCLOSURE });
    const parsed = await parseEmergencyQrV2(encoded);
    expect(parsed?.verification.status).toBe('valid');
    expect(parsed?.info.allergies[0].allergen).toBe('Peanuts');
    expect(parsed?.info.phone).toBe('');
    expect(parsed?.info.street).toBe('Private address');
    expect(parsed?.info.city).toBe('Cebu');
    expect(parsed?.info.religion).toBe('');
    expect(parsed?.info.dateOfBirth).toBe('');
    expect(parsed?.info.age).toBeGreaterThan(0);
    expect(parsed?.info.gender).toBe('female');
  });

  it('rejects a modified signed payload', async () => {
    const encoded = await buildEmergencyQrV2({ patientId: 7, medical, allergies: [], conditions: [], diagnoses: [], medications: [], contacts: [], disclosure: DEFAULT_EMERGENCY_DISCLOSURE });
    const last = encoded.at(-1)!;
    const tampered = `${encoded.slice(0, -1)}${last === 'A' ? 'B' : 'A'}`;
    expect(await parseEmergencyQrV2(tampered)).toBeNull();
  });

  it('represents an empty unconfirmed category as not recorded', async () => {
    const encoded = await buildEmergencyQrV2({ patientId: 7, medical, allergies: [], conditions: [], diagnoses: [], medications: [], contacts: [], disclosure: DEFAULT_EMERGENCY_DISCLOSURE });
    const parsed = await parseEmergencyQrV2(encoded);
    expect(parsed?.info.knowledge?.allergies).toBe('not_recorded');
  });
});
