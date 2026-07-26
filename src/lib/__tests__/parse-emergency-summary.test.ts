import { parseEmergencySummary } from '@/lib/parse-emergency-summary';
import { buildEmergencySummary } from '@/lib/build-emergency-summary';
import { decryptQrPayload } from '@/lib/qr-cipher';
import type { AllergyRow, ConditionRow, DiagnosisRow, EmergencyContactRow, MedicalInformationRow, MedicationRow } from '@/db/schema';

// parseEmergencySummary's own logic starts after decryption; stub decryptQrPayload as an identity
// pass-through so these tests exercise the plaintext parser directly (real encrypt/decrypt needs
// libsodium JSI bindings unavailable under jest-expo's Node environment — see qr-cipher.test.ts).
jest.mock('@/lib/qr-cipher', () => ({ decryptQrPayload: jest.fn((text: string) => Promise.resolve(text)) }));

const mockDecrypt = decryptQrPayload as jest.Mock;

const GENERATED_AT = new Date('2026-07-15T09:30:00.000Z');

function medicalInformation(overrides: Partial<MedicalInformationRow> = {}): MedicalInformationRow {
  return {
    id: 1,
    server_id: 10,
    email: 'glenn@example.com',
    sync_status: 'synced',
    updated_at_local: '2026-07-15T09:00:00.000Z',
    server_updated_at: null,
    full_name: 'Glenn Gain Velasco',
    first_name: 'Glenn',
    middle_name: 'Gain',
    last_name: 'Velasco',
    suffix: null,
    date_of_birth: '1998-04-02',
    gender: 'male',
    phone_country_code: '63',
    phone: '9674352324',
    blood_type: 'A+',
    religion: null,
    address: '12 Mabini St, Cebu',
    no_blood_transfusion: 0,
    ...overrides,
  } as MedicalInformationRow;
}

function medication(overrides: Partial<MedicationRow> = {}): MedicationRow {
  return {
    local_uuid: 'medication-1',
    user_id: 0,
    server_id: 1,
    sync_status: 'synced',
    deleted_locally: 0,
    updated_at_local: '2026-07-15T09:00:00.000Z',
    name: 'Aspirin',
    dosage: '100mg',
    frequency: 'Once daily',
    notes: null,
    ...overrides,
  } as MedicationRow;
}

function diagnosis(overrides: Partial<DiagnosisRow> = {}): DiagnosisRow {
  return {
    local_uuid: 'diagnosis-1',
    user_id: 0,
    server_id: 1,
    sync_status: 'synced',
    deleted_locally: 0,
    updated_at_local: '2026-07-15T09:00:00.000Z',
    condition: 'Hypertension',
    date_of_diagnosis: '2024-03-15',
    severity: 'ongoing',
    ...overrides,
  } as DiagnosisRow;
}

function condition(overrides: Partial<ConditionRow> = {}): ConditionRow {
  return {
    local_uuid: 'condition-1',
    user_id: 0,
    server_id: 1,
    sync_status: 'synced',
    deleted_locally: 0,
    updated_at_local: '2026-07-15T09:00:00.000Z',
    description: 'Occasional migraines',
    ...overrides,
  } as ConditionRow;
}

function contact(overrides: Partial<EmergencyContactRow> = {}): EmergencyContactRow {
  return {
    local_uuid: 'contact-1',
    server_id: 1,
    sync_status: 'synced',
    deleted_locally: 0,
    updated_at_local: '2026-07-15T09:00:00.000Z',
    name: 'Maria Velasco',
    relationship: 'Mother',
    phone_country_code: '63',
    phone: '9171234567',
    is_primary: 1,
    ...overrides,
  } as EmergencyContactRow;
}

describe('parseEmergencySummary', () => {
  it('returns null when the scanned text is not a MediScan emergency QR', async () => {
    mockDecrypt.mockResolvedValueOnce(null);

    expect(await parseEmergencySummary('https://example.com')).toBeNull();
  });

  it('round-trips allergies, conditions, diagnoses, medications and contacts through build → parse', async () => {
    const summary = buildEmergencySummary(
      42,
      GENERATED_AT,
      medicalInformation(),
      [{ local_uuid: 'a1', server_id: 1, sync_status: 'synced', deleted_locally: 0, updated_at_local: '2026-07-15T09:00:00.000Z', allergen: 'Peanuts', reaction: 'Anaphylaxis', severity: 'severe' } as AllergyRow],
      [contact()],
      [diagnosis()],
      [medication({ name: 'Aspirin', dosage: '100mg', frequency: 'Once daily' })],
      [condition({ description: 'Occasional migraines' })],
    );

    const info = await parseEmergencySummary(summary);

    expect(info?.patientId).toBe(42);
    expect(info?.allergies).toEqual([{ allergen: 'Peanuts', severity: 'severe', reaction: 'Anaphylaxis' }]);
    expect(info?.conditions).toEqual([{ description: 'Occasional migraines' }]);
    expect(info?.diagnoses).toEqual([{ condition: 'Hypertension', severity: 'ongoing', dateOfDiagnosis: '2024-03-15' }]);
    expect(info?.medications).toEqual([{ name: 'Aspirin', dosage: '100mg', frequency: 'Once daily' }]);
    expect(info?.emergencyContacts).toEqual([{ name: 'Maria Velasco', relationship: 'Mother', phone: '+63 9171234567' }]);
  });

  it('parses "Medications: none recorded" into an empty medications array', async () => {
    const summary = buildEmergencySummary(1, GENERATED_AT, medicalInformation(), [], [], [], []);

    const info = await parseEmergencySummary(summary);

    expect(info?.medications).toEqual([]);
  });

  it('parses "Conditions: none recorded" into an empty conditions array', async () => {
    const summary = buildEmergencySummary(1, GENERATED_AT, medicalInformation(), [], [], [], [], []);

    const info = await parseEmergencySummary(summary);

    expect(info?.conditions).toEqual([]);
  });

  it('parses a medication line without a frequency as frequency: null', async () => {
    const text = [
      'MEDISCAN EMERGENCY INFO',
      'Patient ID: 1',
      'Generated: 2026-07-15T09:30:00.000Z',
      'Medications:',
      '- Aspirin, 100mg',
    ].join('\n');

    const info = await parseEmergencySummary(text);

    expect(info?.medications).toEqual([{ name: 'Aspirin', dosage: '100mg', frequency: null }]);
  });

  it('does not leak medications into the diagnoses or emergency-contacts sections', async () => {
    const text = [
      'MEDISCAN EMERGENCY INFO',
      'Patient ID: 1',
      'Diagnoses:',
      '- Hypertension, ongoing',
      'Medications:',
      '- Aspirin, 100mg, Once daily',
      'Emergency contacts:',
      '- Maria Velasco (Mother) — 9171234567',
    ].join('\n');

    const info = await parseEmergencySummary(text);

    expect(info?.diagnoses).toEqual([{ condition: 'Hypertension', severity: 'ongoing', dateOfDiagnosis: null }]);
    expect(info?.medications).toEqual([{ name: 'Aspirin', dosage: '100mg', frequency: 'Once daily' }]);
    expect(info?.emergencyContacts).toEqual([{ name: 'Maria Velasco', relationship: 'Mother', phone: '9171234567' }]);
  });
});
