import { setCurrentUserId } from '@/db/context';
import { runMigrations } from '@/db/migrations';
import { createNodeSqliteAdapter } from '@/db/test-utils/node-sqlite-adapter';

import { getDb } from '@/db/client';
import * as professionalAttestationRepo from '@/db/repositories/professional-attestation.repo';

jest.mock('@/db/client', () => ({ getDb: jest.fn() }));

beforeEach(async () => {
  const db = createNodeSqliteAdapter();
  await runMigrations(db);
  (getDb as jest.Mock).mockResolvedValue(db);
  setCurrentUserId(0);
});

describe('professional-attestation.repo', () => {
  it('round-trips an inserted attestation (payload encrypted at rest, decrypted on read)', async () => {
    await professionalAttestationRepo.insert({
      localId: 'att-1',
      sourceEnvelopeLocalId: 'env-1',
      envelopeType: 'allergy_verification',
      payload: { type: 'allergy_verification', allergen: 'Penicillin', severity: 'severe' },
      matchedAllergyLocalUuid: null,
      matchedDiagnosisLocalUuid: null,
    });

    const [row] = await professionalAttestationRepo.getAll();
    expect(row).toMatchObject({
      local_id: 'att-1',
      source_envelope_local_id: 'env-1',
      envelope_type: 'allergy_verification',
      matched_allergy_local_uuid: null,
      matched_diagnosis_local_uuid: null,
      payload: { type: 'allergy_verification', allergen: 'Penicillin', severity: 'severe' },
    });

    const db = await getDb();
    const raw = await db.getFirstAsync<{ encrypted_payload: string }>(
      'SELECT encrypted_payload FROM professional_attestations WHERE local_id = ?',
      'att-1',
    );
    expect(raw!.encrypted_payload).not.toContain('Penicillin');
  });

  it('getForAllergy only returns attestations matched to that allergy', async () => {
    await professionalAttestationRepo.insert({
      localId: 'att-1',
      sourceEnvelopeLocalId: 'env-1',
      envelopeType: 'allergy_verification',
      payload: { allergen: 'Peanuts' },
      matchedAllergyLocalUuid: 'allergy-a',
      matchedDiagnosisLocalUuid: null,
    });
    await professionalAttestationRepo.insert({
      localId: 'att-2',
      sourceEnvelopeLocalId: 'env-2',
      envelopeType: 'allergy_verification',
      payload: { allergen: 'Shellfish' },
      matchedAllergyLocalUuid: 'allergy-b',
      matchedDiagnosisLocalUuid: null,
    });
    await professionalAttestationRepo.insert({
      localId: 'att-3',
      sourceEnvelopeLocalId: 'env-3',
      envelopeType: 'allergy_verification',
      payload: { allergen: 'Ambiguous' },
      matchedAllergyLocalUuid: null,
      matchedDiagnosisLocalUuid: null,
    });

    const forA = await professionalAttestationRepo.getForAllergy('allergy-a');
    expect(forA.map((a) => a.local_id)).toEqual(['att-1']);
  });

  it('setMatchedAllergy confirms an ambiguous attestation without touching its payload', async () => {
    await professionalAttestationRepo.insert({
      localId: 'att-1',
      sourceEnvelopeLocalId: 'env-1',
      envelopeType: 'allergy_verification',
      payload: { allergen: 'Latex' },
      matchedAllergyLocalUuid: null,
      matchedDiagnosisLocalUuid: null,
    });

    await professionalAttestationRepo.setMatchedAllergy('att-1', 'allergy-x');

    const [row] = await professionalAttestationRepo.getAll();
    expect(row.matched_allergy_local_uuid).toBe('allergy-x');
    expect(row.payload).toEqual({ allergen: 'Latex' });
  });

  it('getForDiagnosis only returns attestations matched to that diagnosis', async () => {
    await professionalAttestationRepo.insert({
      localId: 'att-1',
      sourceEnvelopeLocalId: 'env-1',
      envelopeType: 'diagnosis_verification',
      payload: { condition: 'Hypertension' },
      matchedAllergyLocalUuid: null,
      matchedDiagnosisLocalUuid: 'diagnosis-a',
    });
    await professionalAttestationRepo.insert({
      localId: 'att-2',
      sourceEnvelopeLocalId: 'env-2',
      envelopeType: 'diagnosis_verification',
      payload: { condition: 'Flu' },
      matchedAllergyLocalUuid: null,
      matchedDiagnosisLocalUuid: 'diagnosis-b',
    });

    const forA = await professionalAttestationRepo.getForDiagnosis('diagnosis-a');
    expect(forA.map((a) => a.local_id)).toEqual(['att-1']);
  });

  it('setMatchedDiagnosis confirms a diagnosis_verification attestation without touching its payload', async () => {
    await professionalAttestationRepo.insert({
      localId: 'att-1',
      sourceEnvelopeLocalId: 'env-1',
      envelopeType: 'diagnosis_verification',
      payload: { condition: 'Asthma' },
      matchedAllergyLocalUuid: null,
      matchedDiagnosisLocalUuid: null,
    });

    await professionalAttestationRepo.setMatchedDiagnosis('att-1', 'diagnosis-x');

    const [row] = await professionalAttestationRepo.getAll();
    expect(row.matched_diagnosis_local_uuid).toBe('diagnosis-x');
    expect(row.payload).toEqual({ condition: 'Asthma' });
  });
});
