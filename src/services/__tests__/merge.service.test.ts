import * as pendingSyncEnvelopeRepo from '@/db/repositories/pending-sync-envelope.repo';
import * as professionalAttestationRepo from '@/db/repositories/professional-attestation.repo';
import * as allergiesRepo from '@/db/repositories/allergies.repo';
import * as diagnosesRepo from '@/db/repositories/diagnoses.repo';
import * as medicalInformationRepo from '@/db/repositories/medical-information.repo';
import { unseal } from '@/services/sealed-box.service';
import { getPrivateKeypair } from '@/services/device-key.service';
import { processEnvelope } from '@/services/merge.service';
import type { PendingSyncEnvelopeRow , AllergyRow, DiagnosisRow } from '@/db/schema';

jest.mock('@/db/repositories/pending-sync-envelope.repo');
jest.mock('@/db/repositories/professional-attestation.repo');
jest.mock('@/db/repositories/allergies.repo');
jest.mock('@/db/repositories/diagnoses.repo');
jest.mock('@/db/repositories/medical-information.repo');
// Explicit factories: these modules import react-native-libsodium / api/client (which requires
// EXPO_PUBLIC_API_URL) at module scope, so a plain jest.mock() automock would still need to load
// the real module first and blow up in a Node test environment. Stub the shape directly instead.
jest.mock('@/services/sealed-box.service', () => ({ unseal: jest.fn(), seal: jest.fn(), generateKeypair: jest.fn() }));
jest.mock('@/services/device-key.service', () => ({ getPrivateKeypair: jest.fn() }));

const mockUnseal = unseal as jest.Mock;
const mockGetPrivateKeypair = getPrivateKeypair as jest.Mock;
const mockGetAllAllergies = allergiesRepo.getAll as jest.Mock;
const mockGetAllDiagnoses = diagnosesRepo.getAll as jest.Mock;
const mockInsertAttestation = professionalAttestationRepo.insert as jest.Mock;
const mockApplyProfessionalUpdate = medicalInformationRepo.applyProfessionalUpdate as jest.Mock;

function makeEnvelope(overrides: Partial<PendingSyncEnvelopeRow> = {}): PendingSyncEnvelopeRow {
  return {
    local_id: 'env-1',
    user_id: 0,
    server_envelope_id: 1,
    transport: 'relay',
    sender_id: 9,
    envelope_type: 'allergy_verification',
    ciphertext: 'sealed-blob',
    status: 'received',
    decrypt_error: null,
    expires_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    processed_at: null,
    ...overrides,
  };
}

function makeAllergy(overrides: Partial<AllergyRow> = {}): AllergyRow {
  return {
    local_uuid: 'allergy-1',
    user_id: 0,
    server_id: null,
    sync_status: 'synced',
    deleted_locally: 0,
    updated_at_local: '2026-01-01T00:00:00.000Z',
    allergen: 'Penicillin',
    reaction: null,
    severity: 'severe',
    ...overrides,
  };
}

function makeDiagnosis(overrides: Partial<DiagnosisRow> = {}): DiagnosisRow {
  return {
    local_uuid: 'diagnosis-1',
    user_id: 0,
    server_id: null,
    sync_status: 'synced',
    deleted_locally: 0,
    updated_at_local: '2026-01-01T00:00:00.000Z',
    condition: 'Hypertension',
    date_of_diagnosis: null,
    severity: 'ongoing',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPrivateKeypair.mockResolvedValue({ publicKey: new Uint8Array(), privateKey: new Uint8Array() });
  mockGetAllAllergies.mockResolvedValue([]);
  mockGetAllDiagnoses.mockResolvedValue([]);
});

describe('processEnvelope', () => {
  it('marks an envelope past expires_at as expired without attempting to unseal it', async () => {
    const envelope = makeEnvelope({ expires_at: '2020-01-01T00:00:00.000Z' });

    const result = await processEnvelope(envelope);

    expect(result).toBe('expired');
    expect(pendingSyncEnvelopeRepo.markExpired).toHaveBeenCalledWith('env-1');
    expect(mockUnseal).not.toHaveBeenCalled();
    expect(pendingSyncEnvelopeRepo.markMerged).not.toHaveBeenCalled();
  });

  it('marks decrypt_failed when unseal returns null (wrong key / corrupted ciphertext), and never acks', async () => {
    mockUnseal.mockResolvedValue(null);
    const envelope = makeEnvelope();

    const result = await processEnvelope(envelope);

    expect(result).toBe('decrypt_failed');
    expect(pendingSyncEnvelopeRepo.markDecryptFailed).toHaveBeenCalledWith('env-1', 'unseal_failed');
    expect(pendingSyncEnvelopeRepo.markMerged).not.toHaveBeenCalled();
    expect(mockInsertAttestation).not.toHaveBeenCalled();
  });

  it('marks decrypt_failed when the decrypted plaintext does not match its declared envelope_type schema', async () => {
    mockUnseal.mockResolvedValue({ type: 'allergy_verification', version: 1, allergen: 'X' /* missing required fields */ });
    const envelope = makeEnvelope();

    const result = await processEnvelope(envelope);

    expect(result).toBe('decrypt_failed');
    expect(pendingSyncEnvelopeRepo.markDecryptFailed).toHaveBeenCalledWith('env-1', 'schema_validation_failed');
  });

  it('merges and auto-matches an allergy_verification envelope with exactly one case-insensitive allergen match', async () => {
    mockUnseal.mockResolvedValue({
      type: 'allergy_verification',
      version: 1,
      allergen: 'penicillin',
      reaction: null,
      severity: 'severe',
      verified_by: { user_id: 1, name: 'Dr. Reyes' },
      verified_at: '2026-01-01T00:00:00.000Z',
    });
    mockGetAllAllergies.mockResolvedValue([makeAllergy({ local_uuid: 'allergy-1', allergen: 'Penicillin' })]);
    const envelope = makeEnvelope();

    const result = await processEnvelope(envelope);

    expect(result).toBe('merged');
    expect(mockInsertAttestation).toHaveBeenCalledWith(
      expect.objectContaining({ matchedAllergyLocalUuid: 'allergy-1', sourceEnvelopeLocalId: 'env-1' }),
    );
    expect(pendingSyncEnvelopeRepo.markMerged).toHaveBeenCalledWith('env-1');
  });

  it('stores an ambiguous match (two allergies with the same name) unmatched rather than guessing', async () => {
    mockUnseal.mockResolvedValue({
      type: 'allergy_verification',
      version: 1,
      allergen: 'Penicillin',
      reaction: null,
      severity: 'severe',
      verified_by: { user_id: 1, name: 'Dr. Reyes' },
      verified_at: '2026-01-01T00:00:00.000Z',
    });
    mockGetAllAllergies.mockResolvedValue([
      makeAllergy({ local_uuid: 'allergy-1', allergen: 'Penicillin' }),
      makeAllergy({ local_uuid: 'allergy-2', allergen: 'Penicillin' }),
    ]);

    const result = await processEnvelope(makeEnvelope());

    expect(result).toBe('merged');
    expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedAllergyLocalUuid: null }));
  });

  it('stores a no-match allergy_verification unmatched rather than guessing', async () => {
    mockUnseal.mockResolvedValue({
      type: 'allergy_verification',
      version: 1,
      allergen: 'Something Unrecorded',
      reaction: null,
      severity: 'mild',
      verified_by: { user_id: 1, name: 'Dr. Reyes' },
      verified_at: '2026-01-01T00:00:00.000Z',
    });
    mockGetAllAllergies.mockResolvedValue([makeAllergy({ local_uuid: 'allergy-1', allergen: 'Penicillin' })]);

    await processEnvelope(makeEnvelope());

    expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedAllergyLocalUuid: null }));
  });

  it('never attempts an allergy match for non-allergy envelope types', async () => {
    mockUnseal.mockResolvedValue({
      type: 'general_note',
      version: 1,
      note: 'hello',
      author: { user_id: 1, name: 'Dr. Reyes' },
      created_at: '2026-01-01T00:00:00.000Z',
    });

    await processEnvelope(makeEnvelope({ envelope_type: 'general_note' }));

    expect(mockGetAllAllergies).not.toHaveBeenCalled();
    expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedAllergyLocalUuid: null }));
  });

  it('auto-applies a medical_information_update envelope to the patient profile and records an attestation', async () => {
    const fields = { blood_type: 'O+', no_blood_transfusion: true };
    mockUnseal.mockResolvedValue({
      type: 'medical_information_update',
      version: 1,
      fields,
      updated_by: { user_id: 2, name: 'Nurse Santos' },
      updated_at: '2026-01-01T00:00:00.000Z',
    });

    const result = await processEnvelope(makeEnvelope({ envelope_type: 'medical_information_update' }));

    expect(result).toBe('merged');
    expect(mockApplyProfessionalUpdate).toHaveBeenCalledWith(fields);
    expect(mockInsertAttestation).toHaveBeenCalledWith(
      expect.objectContaining({ sourceEnvelopeLocalId: 'env-1', matchedAllergyLocalUuid: null }),
    );
    expect(pendingSyncEnvelopeRepo.markMerged).toHaveBeenCalledWith('env-1');
  });

  it('merges and auto-matches a diagnosis_verification envelope with exactly one case-insensitive condition match', async () => {
    mockUnseal.mockResolvedValue({
      type: 'diagnosis_verification',
      version: 1,
      condition: 'hypertension',
      date_of_diagnosis: null,
      severity: 'ongoing',
      verified_by: { user_id: 1, name: 'Dr. Reyes' },
      verified_at: '2026-01-01T00:00:00.000Z',
    });
    mockGetAllDiagnoses.mockResolvedValue([makeDiagnosis({ local_uuid: 'diagnosis-1', condition: 'Hypertension' })]);
    const envelope = makeEnvelope({ envelope_type: 'diagnosis_verification' });

    const result = await processEnvelope(envelope);

    expect(result).toBe('merged');
    expect(mockInsertAttestation).toHaveBeenCalledWith(
      expect.objectContaining({ matchedDiagnosisLocalUuid: 'diagnosis-1', matchedAllergyLocalUuid: null, sourceEnvelopeLocalId: 'env-1' }),
    );
    expect(pendingSyncEnvelopeRepo.markMerged).toHaveBeenCalledWith('env-1');
  });

  it('stores an ambiguous diagnosis match (two diagnoses with the same condition) unmatched rather than guessing', async () => {
    mockUnseal.mockResolvedValue({
      type: 'diagnosis_verification',
      version: 1,
      condition: 'Hypertension',
      date_of_diagnosis: null,
      severity: 'ongoing',
      verified_by: { user_id: 1, name: 'Dr. Reyes' },
      verified_at: '2026-01-01T00:00:00.000Z',
    });
    mockGetAllDiagnoses.mockResolvedValue([
      makeDiagnosis({ local_uuid: 'diagnosis-1', condition: 'Hypertension' }),
      makeDiagnosis({ local_uuid: 'diagnosis-2', condition: 'Hypertension' }),
    ]);

    const result = await processEnvelope(makeEnvelope({ envelope_type: 'diagnosis_verification' }));

    expect(result).toBe('merged');
    expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedDiagnosisLocalUuid: null }));
  });

  it('stores a no-match diagnosis_verification unmatched rather than guessing', async () => {
    mockUnseal.mockResolvedValue({
      type: 'diagnosis_verification',
      version: 1,
      condition: 'Something Unrecorded',
      date_of_diagnosis: null,
      severity: 'acute',
      verified_by: { user_id: 1, name: 'Dr. Reyes' },
      verified_at: '2026-01-01T00:00:00.000Z',
    });
    mockGetAllDiagnoses.mockResolvedValue([makeDiagnosis({ local_uuid: 'diagnosis-1', condition: 'Hypertension' })]);

    await processEnvelope(makeEnvelope({ envelope_type: 'diagnosis_verification' }));

    expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedDiagnosisLocalUuid: null }));
  });
});
