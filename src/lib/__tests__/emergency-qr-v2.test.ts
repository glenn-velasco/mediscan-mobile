import { buildEmergencyQrV2, parseEmergencyQrV2 } from '@/lib/emergency-qr-v2';
import { createQrMatrix } from '@/lib/qr-matrix';
import { DEFAULT_EMERGENCY_DISCLOSURE } from '@/types/emergency';
import type { AllergyRow, ConditionRow, DiagnosisRow, EmergencyContactRow, MedicalInformationRow, MedicationRow } from '@/db/schema';
import type { ProfessionalEncounter } from '@/api/types';

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
  address: JSON.stringify({ street: 'Private address', barangay: 'Barangay 1', city: 'Cebu' }),
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
  it('round-trips a signed emergency payload with date of birth and phone', async () => {
    const encoded = await buildEmergencyQrV2({ patientId: 7, medical, allergies: [allergy], conditions: [], diagnoses: [], medications: [], contacts: [], disclosure: DEFAULT_EMERGENCY_DISCLOSURE });
    const parsed = await parseEmergencyQrV2(encoded);
    expect(parsed?.verification.status).toBe('valid');
    expect(parsed?.info.allergies[0].allergen).toBe('Peanuts');
    expect(parsed?.info.phone).toBe('9123456789');
    expect(parsed?.info.street).toBe('Private address');
    expect(parsed?.info.barangay).toBe('Barangay 1');
    expect(parsed?.info.city).toBe('Cebu');
    expect(parsed?.info.religion).toBe('');
    expect(parsed?.info.dateOfBirth).toBe('1990-01-01');
    expect(parsed?.info.withheld).toEqual({ dateOfBirth: false, bloodType: false, phone: false });
    expect(parsed?.info.bloodType).toBe('o_positive');
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

  it('includes only history for fields disclosed in the emergency QR', async () => {
    const recentHistory = [
      { id: 'dob-change', field: 'date_of_birth' as const, value: '1990-01-01', changedAt: new Date().toISOString(), serverRecordedAt: null, syncStatus: 'pending' as const },
      { id: 'blood-change', field: 'blood_type' as const, value: 'o_positive', changedAt: new Date().toISOString(), serverRecordedAt: null, syncStatus: 'pending' as const },
    ];
    const encoded = await buildEmergencyQrV2({ patientId: 7, medical, allergies: [], conditions: [], diagnoses: [], medications: [], contacts: [], disclosure: DEFAULT_EMERGENCY_DISCLOSURE, recentHistory });
    const parsed = await parseEmergencyQrV2(encoded);
    expect(parsed?.info.recentHistory?.map((event) => event.field)).toEqual(['date_of_birth', 'blood_type']);
  });

  it('caps large payloads so QR code matrix generates successfully without exceeding capacity', async () => {
    const manyAllergies: AllergyRow[] = Array.from({ length: 30 }, (_, index) => ({
      local_uuid: `alg-${index}`, user_id: 7, server_id: index,
      allergen: `Allergen substance number ${index} with unusually long descriptive text`,
      reaction: `Severe reaction details and emergency protocol description ${index}`,
      severity: 'life-threatening',
      verified_by: null, sync_status: 'synced', deleted_locally: 0, updated_at_local: new Date().toISOString(),
    }));

    const manyConditions = Array.from({ length: 25 }, (_, index) => ({
      local_uuid: `cnd-${index}`, user_id: 7, server_id: index,
      description: `Chronic condition description number ${index} containing extensive clinical details`,
      verified_by: null, sync_status: 'synced' as const, deleted_locally: 0 as const, updated_at_local: new Date().toISOString(),
    })) as ConditionRow[];

    const manyDiagnoses = Array.from({ length: 25 }, (_, index) => ({
      local_uuid: `dgn-${index}`, user_id: 7, server_id: index,
      condition: `Diagnosis title and classification code ICD-10 ${index}`,
      severity: 'acute' as const, date_of_diagnosis: '2023-05-15',
      diagnosed_by_id: null, diagnosed_by_name: null, verified_by: null,
      sync_status: 'synced' as const, deleted_locally: 0 as const, updated_at_local: new Date().toISOString(),
    })) as DiagnosisRow[];

    const manyMedications = Array.from({ length: 30 }, (_, index) => ({
      local_uuid: `med-${index}`, user_id: 7, server_id: index,
      name: `Medication generic name and brand name ${index}`,
      dosage: '500mg twice daily with meals',
      frequency: 'Every 12 hours as directed by physician',
      notes: null, verified_by: null,
      sync_status: 'synced' as const, deleted_locally: 0 as const, updated_at_local: new Date().toISOString(),
    })) as MedicationRow[];

    const manyContacts = Array.from({ length: 10 }, (_, index) => ({
      local_uuid: `cnt-${index}`, user_id: 7, server_id: index,
      name: `Primary emergency contact person ${index}`,
      relationship: 'Immediate family member',
      phone: '09171234567', phone_country_code: '63',
      is_primary: 0 as const,
      sync_status: 'synced' as const, deleted_locally: 0 as const, updated_at_local: new Date().toISOString(),
    })) as EmergencyContactRow[];

    const encounter: ProfessionalEncounter = {
      id: '99',
      patient_id: '7',
      professional_id: 'PRC-123456',
      professional_name: 'Dr. Maria Santos MD',
      observations: 'Patient presented with severe acute respiratory distress following exposure. Clinical evaluation showed wheezing and tachycardia. Extensive observation notes follow here with substantial detail.'.repeat(5),
      actionsTaken: 'Administered epinephrine 0.3mg IM immediately followed by nebulized albuterol. Monitored oxygen saturation and heart rate closely. Patient stabilized.'.repeat(5),
      recordedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      verifiedBy: { name: 'Dr. Maria Santos', userId: 'PRC-123456' },
      vitals: Array.from({ length: 15 }, () => ({
        kind: 'blood_pressure', value: '120/80', unit: 'mmHg', measuredAt: new Date().toISOString(), recordedBy: 'Dr. Santos',
      })),
    };

    const encoded = await buildEmergencyQrV2({
      patientId: 7,
      medical,
      allergies: manyAllergies,
      conditions: manyConditions,
      diagnoses: manyDiagnoses,
      medications: manyMedications,
      contacts: manyContacts,
      disclosure: DEFAULT_EMERGENCY_DISCLOSURE,
      latestVerifiedEncounter: encounter,
    });

    // The QR matrix must generate cleanly without throwing or returning null
    const matrix = createQrMatrix(encoded);
    expect(matrix).not.toBeNull();
    expect(matrix!.length).toBeGreaterThan(20);

    // The payload must still be verifiable and parse correctly
    const parsed = await parseEmergencyQrV2(encoded);
    expect(parsed?.verification.status).toBe('valid');
    expect(parsed?.info.name).toBe('Sample Patient');
    expect(parsed?.info.bloodType).toBe('o_positive');
    expect(parsed?.info.allergies.length).toBeGreaterThan(0);
    expect(parsed?.info.medications.length).toBeGreaterThan(0);
  });
});
