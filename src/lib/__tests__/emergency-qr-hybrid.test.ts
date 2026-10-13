import QRCode from 'qrcode';

import { buildHybridEmergencyQr, parseHybridEmergencyQr, QR_HYBRID_PREFIX } from '@/lib/emergency-qr-hybrid';
import type { ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';

jest.mock('react-native-libsodium', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sodium = require('libsodium-wrappers');
  return { __esModule: true, default: sodium, ready: sodium.ready };
});

const mockSecureValues = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: (key: string) => Promise.resolve(mockSecureValues.get(key) ?? null),
  setItemAsync: (key: string, value: string) => { mockSecureValues.set(key, value); return Promise.resolve(); },
  deleteItemAsync: (key: string) => { mockSecureValues.delete(key); return Promise.resolve(); },
}));

const token = 'A'.repeat(43);
const now = new Date().toISOString();
const info: ScannedEmergencyInfo = {
  patientId: 'patient-1', generatedAt: now, lastUpdatedAt: now,
  name: 'Sample Patient', firstName: '', middleName: '', lastName: '', suffix: '',
  dateOfBirth: '1990-01-01', gender: 'female', bloodType: 'o_positive', religion: '',
  noBloodTransfusion: 'No', phone: '09123456789', phoneCountryCode: '63',
  street: 'Private Street', unit: '', barangay: 'Barangay 1', city: 'Cebu', province: '', postalCode: '', country: '',
  allergies: [{ allergen: 'Peanuts', severity: 'severe', reaction: 'Anaphylaxis' }],
  conditions: [{ description: 'Asthma' }], diagnoses: [],
  medications: [{ name: 'Salbutamol', dosage: '100 mcg', frequency: 'as needed' }],
  emergencyContacts: [{ name: 'First Contact', relationship: 'Parent', phone: '+639123456789' }, { name: 'Second Contact', relationship: 'Friend', phone: '+639876543210' }],
  knowledge: { allergies: 'recorded', medications: 'recorded', diagnoses: 'not_recorded', conditions: 'recorded' },
};

describe('hybrid printable emergency QR', () => {
  it('round-trips a signed offline summary with contacts and address', async () => {
    const raw = await buildHybridEmergencyQr(info.patientId!, token, info);
    const parsed = await parseHybridEmergencyQr(raw);
    expect(raw.startsWith(QR_HYBRID_PREFIX)).toBe(true);
    expect(QRCode.create(raw, { errorCorrectionLevel: 'M' }).modules.size).toBeLessThanOrEqual(113);
    expect(parsed?.verification.status).toBe('valid');
    expect(parsed?.token).toBe(token);
    expect(parsed?.info.allergies).toEqual(info.allergies);
    expect(parsed?.info.medications).toEqual(info.medications);
    expect(parsed?.info.emergencyContacts).toEqual(info.emergencyContacts);
    expect(parsed?.info.dateOfBirth).toBe('1990-01-01');
    expect(parsed?.info.gender).toBe('female');
    expect(parsed?.info.phone).toBe('09123456789');
    expect(parsed?.info.phoneCountryCode).toBe('63');
    expect(parsed?.info.street).toBe('Private Street');
    expect(parsed?.info.barangay).toBe('Barangay 1');
    expect(parsed?.info.city).toBe('Cebu');
  });

  it('rejects changes to the signed token or snapshot', async () => {
    const raw = await buildHybridEmergencyQr(info.patientId!, token, info);
    expect(await parseHybridEmergencyQr(`${raw.slice(0, -2)}XX`)).toBeNull();
    expect(await parseHybridEmergencyQr('MEDISCAN:v4:invalid')).toBeNull();
  });

  it('refuses to print a wallet card without gender', async () => {
    await expect(buildHybridEmergencyQr(info.patientId!, token, { ...info, gender: '' }))
      .rejects.toThrow('Gender is missing from the local emergency profile');
  });

  it('does not silently discard an oversized medical summary', async () => {
    const large = { ...info, allergies: Array.from({ length: 30 }, (_, index) => ({ allergen: `Allergen ${index} ${index.toString(36).repeat(80)}`, severity: 'severe', reaction: `Reaction ${index.toString(36).repeat(80)}` })) };
    await expect(buildHybridEmergencyQr(large.patientId!, token, large)).rejects.toThrow('too large');
  });

  it('labels an old printed medical snapshot as stale', async () => {
    const old = { ...info, lastUpdatedAt: '2020-01-01T00:00:00.000Z' };
    const raw = await buildHybridEmergencyQr(old.patientId!, token, old);
    expect((await parseHybridEmergencyQr(raw))?.verification.status).toBe('stale');
  });
});
