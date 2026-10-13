/** See qr-cipher.test.ts: react-native-libsodium's JSI bindings aren't available under jest-expo's Node environment. */
import { buildEmergencySummary } from '@/lib/build-emergency-summary';
import { parseEmergencySummary } from '@/lib/parse-emergency-summary';
import { encryptQrPayload } from '@/lib/qr-cipher';
import type { AllergyRow, ConditionRow, EmergencyContactRow, MedicalInformationRow, MedicationRow } from '@/db/schema';

jest.mock('react-native-libsodium', () => {
  const sodium = require('libsodium-wrappers');
  return { __esModule: true, default: sodium, ready: sodium.ready };
});

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
    blood_type: 'a_positive',
    religion: null,
    address: JSON.stringify({
      street: '12 Mabini St',
      unit: null,
      barangay: 'Barangay 10',
      city: 'Cebu City',
      province: 'Cebu',
      postal_code: '6000',
      country: 'Philippines',
    }),
    no_blood_transfusion: 0,
    ...overrides,
  } as MedicalInformationRow;
}

function allergy(overrides: Partial<AllergyRow> = {}): AllergyRow {
  return {
    local_uuid: 'allergy-1',
    server_id: 1,
    sync_status: 'synced',
    deleted_locally: 0,
    updated_at_local: '2026-07-15T09:00:00.000Z',
    allergen: 'Peanuts',
    reaction: null,
    severity: 'severe',
    ...overrides,
  } as AllergyRow;
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

describe('buildEmergencySummary', () => {
  it('leads with the header, patient id and an ISO generation timestamp', () => {
    const summary = buildEmergencySummary(42, GENERATED_AT, medicalInformation(), [], []);

    expect(summary.split('\n').slice(0, 3)).toEqual([
      'MEDISCAN EMERGENCY INFO',
      'Patient ID: 42',
      'Generated: 2026-07-15T09:30:00.000Z',
    ]);
  });

  it('includes the identity and contact details a responder needs', () => {
    const summary = buildEmergencySummary(1, GENERATED_AT, medicalInformation(), [], []);

    expect(summary).toContain('Name: Glenn Gain Velasco');
    expect(summary).toContain('DOB: 1998-04-02');
    expect(summary).toContain('Gender: male');
    expect(summary).toContain('Phone: 9674352324');
    expect(summary).toContain('Phone country code: 63');
    expect(summary).toContain('Street: 12 Mabini St');
    expect(summary).toContain('City: Cebu City');
    expect(summary).toContain('Province: Cebu');
    expect(summary).toContain('Postal code: 6000');
    expect(summary).toContain('Country: Philippines');
  });

  it('renders the no-blood-transfusion flag as Yes/No rather than a raw 0/1', () => {
    const declines = buildEmergencySummary(
      1,
      GENERATED_AT,
      medicalInformation({ no_blood_transfusion: 1 }),
      [],
      [],
    );
    const accepts = buildEmergencySummary(
      1,
      GENERATED_AT,
      medicalInformation({ no_blood_transfusion: 0 }),
      [],
      [],
    );

    expect(declines).toContain('No blood transfusion: Yes');
    expect(accepts).toContain('No blood transfusion: No');
  });

  it('falls back to Unknown / em-dash instead of printing empty values', () => {
    const summary = buildEmergencySummary(
      1,
      GENERATED_AT,
      medicalInformation({
        full_name: '',
        date_of_birth: null,
        gender: null,
        phone: null,
        phone_country_code: null,
        address: null,
      }),
      [],
      [],
    );

    expect(summary).toContain('Name: Unknown');
    expect(summary).toContain('DOB: —');
    expect(summary).toContain('Gender: —');
    expect(summary).toContain('Phone: —');
    expect(summary).toContain('Phone country code: —');
    expect(summary).toContain('Street: —');
    expect(summary).toContain('City: —');
    expect(summary).toContain('Province: —');
    expect(summary).toContain('Postal code: —');
    expect(summary).toContain('Country: —');
  });

  /**
   * `useQrWidget` passes the allergies query's `data` straight through, which is `undefined`
   * until the query resolves — so the undefined branch is a real runtime state, not a nicety.
   */
  it.each([
    ['an empty list', [] as AllergyRow[]],
    ['an unresolved query (undefined)', undefined],
  ])('reports no allergies recorded for %s', (_label, allergies) => {
    const summary = buildEmergencySummary(1, GENERATED_AT, medicalInformation(), allergies, []);

    expect(summary).toContain('Allergies: none recorded');
    expect(summary).not.toContain('Allergies:\n');
  });

  it('lists each allergy with its severity, appending the reaction only when present', () => {
    const summary = buildEmergencySummary(
      1,
      GENERATED_AT,
      medicalInformation(),
      [
        allergy({ allergen: 'Peanuts', severity: 'life-threatening', reaction: 'Anaphylaxis' }),
        allergy({ local_uuid: 'allergy-2', allergen: 'Pollen', severity: 'mild', reaction: null }),
      ],
      [],
    );

    expect(summary).toContain('Allergies:');
    expect(summary).toContain('- Peanuts (life-threatening, Anaphylaxis)');
    expect(summary).toContain('- Pollen (mild)');
  });

  it.each([
    ['an empty list', [] as MedicationRow[]],
    ['an unresolved query (undefined)', undefined],
  ])('reports no medications recorded for %s', (_label, medications) => {
    const summary = buildEmergencySummary(1, GENERATED_AT, medicalInformation(), [], [], undefined, medications);

    expect(summary).toContain('Medications: none recorded');
    expect(summary).not.toContain('Medications:\n');
  });

  it('lists each medication with its dosage, appending the frequency only when present', () => {
    const summary = buildEmergencySummary(
      1,
      GENERATED_AT,
      medicalInformation(),
      [],
      [],
      undefined,
      [
        medication({ name: 'Aspirin', dosage: '100mg', frequency: 'Once daily' }),
        medication({ local_uuid: 'medication-2', name: 'Ibuprofen', dosage: '200mg', frequency: '' }),
      ],
    );

    expect(summary).toContain('Medications:');
    expect(summary).toContain('- Aspirin, 100mg, Once daily');
    expect(summary).toContain('- Ibuprofen, 200mg');
    expect(summary).not.toContain('- Ibuprofen, 200mg,');
  });

  it.each([
    ['an empty list', [] as ConditionRow[]],
    ['an unresolved query (undefined)', undefined],
  ])('reports no conditions recorded for %s', (_label, conditions) => {
    const summary = buildEmergencySummary(1, GENERATED_AT, medicalInformation(), [], [], undefined, undefined, conditions);

    expect(summary).toContain('Conditions: none recorded');
    expect(summary).not.toContain('Conditions:\n');
  });

  it('lists each condition by its description', () => {
    const summary = buildEmergencySummary(
      1,
      GENERATED_AT,
      medicalInformation(),
      [],
      [],
      undefined,
      undefined,
      [
        condition({ description: 'Occasional migraines' }),
        condition({ local_uuid: 'condition-2', description: 'Seasonal allergies' }),
      ],
    );

    expect(summary).toContain('Conditions:');
    expect(summary).toContain('- Occasional migraines');
    expect(summary).toContain('- Seasonal allergies');
  });

  it('omits the emergency contacts section entirely when there are none', () => {
    const summary = buildEmergencySummary(1, GENERATED_AT, medicalInformation(), [], []);

    expect(summary).not.toContain('Emergency contacts:');
  });

  it('formats a contact with its relationship and country-prefixed phone', () => {
    const summary = buildEmergencySummary(1, GENERATED_AT, medicalInformation(), [], [contact()]);

    expect(summary).toContain('Emergency contacts:');
    expect(summary).toContain('- Maria Velasco (Mother) — +63 9171234567');
  });

  it('degrades a contact gracefully when relationship, country code or phone are missing', () => {
    const summary = buildEmergencySummary(
      1,
      GENERATED_AT,
      medicalInformation(),
      [],
      [
        contact({ relationship: null, phone_country_code: null, phone: '9171234567' }),
        contact({ local_uuid: 'contact-2', name: 'Jose', relationship: null, phone: null }),
      ],
    );

    expect(summary).toContain('- Maria Velasco — 9171234567');
    expect(summary).toContain('- Jose');
  });

  /**
   * The payload is the plaintext behind the QR, so what it does *not* carry matters as much as
   * what it does. The email is stored on the profile but deliberately stays out of the QR.
   */
  it('does not leak profile fields that are not part of the QR contract', () => {
    const summary = buildEmergencySummary(
      1,
      GENERATED_AT,
      medicalInformation({ religion: 'catholic', blood_type: 'a_positive' }),
      [],
      [],
    );

    expect(summary).not.toContain('glenn@example.com');
  });

  it('round-trips structured address, phone country code and emergency contacts through parseEmergencySummary', async () => {
    const summary = buildEmergencySummary(1, GENERATED_AT, medicalInformation(), [], [contact()]);
    const encoded = await encryptQrPayload(summary);
    const parsed = await parseEmergencySummary(encoded);

    expect(parsed).not.toBeNull();
    expect(parsed?.phone).toBe('9674352324');
    expect(parsed?.phoneCountryCode).toBe('63');
    expect(parsed?.street).toBe('12 Mabini St');
    expect(parsed?.barangay).toBe('Barangay 10');
    expect(parsed?.city).toBe('Cebu City');
    expect(parsed?.province).toBe('Cebu');
    expect(parsed?.postalCode).toBe('6000');
    expect(parsed?.country).toBe('Philippines');
    expect(parsed?.emergencyContacts).toEqual([
      { name: 'Maria Velasco', relationship: 'Mother', phone: '+63 9171234567' },
    ]);
  });
});
