import { parseEmergencySummary } from '@/lib/parse-emergency-summary';
import { decryptQrPayload } from '@/lib/qr-cipher';

// parseEmergencySummary's own logic starts after decryption; stub decryptQrPayload as an identity
// pass-through so these tests exercise the plaintext parser directly (real encrypt/decrypt needs
// libsodium JSI bindings unavailable under jest-expo's Node environment — see qr-cipher.test.ts).
jest.mock('@/lib/qr-cipher', () => ({ decryptQrPayload: jest.fn((text: string) => Promise.resolve(text)) }));

const mockDecrypt = decryptQrPayload as jest.Mock;

function legacyText(...sections: string[]): string {
  return [
    'MEDISCAN EMERGENCY INFO',
    'Patient ID: 42',
    'Generated: 2026-07-15T09:30:00.000Z',
    ...sections,
  ].join('\n');
}

describe('parseEmergencySummary', () => {
  it('returns null when the scanned text is not a MediScan emergency QR', async () => {
    mockDecrypt.mockResolvedValueOnce(null);

    expect(await parseEmergencySummary('https://example.com')).toBeNull();
  });

  it('parses the previously issued emergency summary format', async () => {
    const summary = legacyText(
      'Allergies:',
      '- Peanuts (severe, Anaphylaxis)',
      'Conditions:',
      '- Occasional migraines',
      'Diagnoses:',
      '- Hypertension, ongoing, 2024-03-15',
      'Medications:',
      '- Aspirin, 100mg, Once daily',
      'Emergency contacts:',
      '- Maria Velasco (Mother) — +63 9171234567',
    );

    const info = await parseEmergencySummary(summary);

    expect(info?.patientId).toBe(42);
    expect(info?.allergies).toEqual([{ allergen: 'Peanuts', severity: 'severe', reaction: 'Anaphylaxis' }]);
    expect(info?.conditions).toEqual([{ description: 'Occasional migraines' }]);
    expect(info?.diagnoses).toEqual([{ condition: 'Hypertension', severity: 'ongoing', dateOfDiagnosis: '2024-03-15' }]);
    expect(info?.medications).toEqual([{ name: 'Aspirin', dosage: '100mg', frequency: 'Once daily' }]);
    expect(info?.emergencyContacts).toEqual([{ name: 'Maria Velasco', relationship: 'Mother', phone: '+63 9171234567' }]);
  });

  it('parses a verified encounter embedded in a previously issued summary', async () => {
    const summary = legacyText(
      `Verified encounter: ${JSON.stringify({
        by: 'Dr. Ana Cruz',
        byId: 'professional-1',
        at: '2026-07-15T09:20:00.000Z',
        updated: '2026-07-15T09:25:00.000Z',
        observations: 'Patient alert and responsive.',
        actions: 'Oxygen administered.',
        vitals: [{ kind: 'oxygen_saturation', value: '96', unit: '%', at: '2026-07-15T09:21:00.000Z', by: 'Dr. Ana Cruz' }],
      })}`,
    );

    const info = await parseEmergencySummary(summary);

    expect(info?.latestVerifiedEncounter).toEqual({
      professionalName: 'Dr. Ana Cruz', professionalId: 'professional-1', recordedAt: '2026-07-15T09:20:00.000Z', updatedAt: '2026-07-15T09:25:00.000Z',
      observations: 'Patient alert and responsive.', actionsTaken: 'Oxygen administered.',
      vitals: [{ kind: 'oxygen_saturation', value: '96', unit: '%', measuredAt: '2026-07-15T09:21:00.000Z', recordedBy: 'Dr. Ana Cruz' }],
    });
  });

  it('parses "Medications: none recorded" into an empty medications array', async () => {
    const summary = legacyText('Medications: none recorded');

    const info = await parseEmergencySummary(summary);

    expect(info?.medications).toEqual([]);
  });

  it('parses "Conditions: none recorded" into an empty conditions array', async () => {
    const summary = legacyText('Conditions: none recorded');

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
