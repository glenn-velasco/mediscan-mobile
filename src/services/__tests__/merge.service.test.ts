import * as pendingSyncEnvelopeRepo from '@/db/repositories/pending-sync-envelope.repo';
import * as professionalAttestationRepo from '@/db/repositories/professional-attestation.repo';
import * as allergiesRepo from '@/db/repositories/allergies.repo';
import * as conditionsRepo from '@/db/repositories/conditions.repo';
import * as diagnosesRepo from '@/db/repositories/diagnoses.repo';
import * as medicationsRepo from '@/db/repositories/medications.repo';
import * as medicalInformationRepo from '@/db/repositories/medical-information.repo';
import { unseal } from '@/services/sealed-box.service';
import { getPrivateKeypair } from '@/services/device-key.service';
import { processEnvelope } from '@/services/merge.service';
import type { PendingSyncEnvelopeRow , AllergyRow, ConditionRow, DiagnosisRow, MedicationRow } from '@/db/schema';

jest.mock('@/db/repositories/pending-sync-envelope.repo');
jest.mock('@/db/repositories/professional-attestation.repo');
jest.mock('@/db/repositories/allergies.repo');
jest.mock('@/db/repositories/conditions.repo');
jest.mock('@/db/repositories/diagnoses.repo');
jest.mock('@/db/repositories/medications.repo');
jest.mock('@/db/repositories/medical-information.repo');
// Explicit factories: these modules import react-native-libsodium / api/client (which requires
// EXPO_PUBLIC_API_URL) at module scope, so a plain jest.mock() automock would still need to load
// the real module first and blow up in a Node test environment. Stub the shape directly instead.
jest.mock('@/services/sealed-box.service', () => ({ unseal: jest.fn(), seal: jest.fn(), generateKeypair: jest.fn() }));
jest.mock('@/services/device-key.service', () => ({ getPrivateKeypair: jest.fn() }));
// merge.service imports queryClient (from '@/lib/query-client') for post-merge cache invalidation;
// that module pulls in @react-native-async-storage/async-storage at module scope, whose native
// module isn't available under jest-expo's Node environment. Stub the shape directly instead.
jest.mock('@/lib/query-client', () => ({ queryClient: { invalidateQueries: jest.fn() } }));

const mockUnseal = unseal as jest.Mock;
const mockGetPrivateKeypair = getPrivateKeypair as jest.Mock;
const mockGetAllAllergies = allergiesRepo.getAll as jest.Mock;
const mockGetAllConditions = conditionsRepo.getAll as jest.Mock;
const mockGetAllDiagnoses = diagnosesRepo.getAll as jest.Mock;
const mockGetAllMedications = medicationsRepo.getAll as jest.Mock;
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
    diagnosed_by_id: null,
    diagnosed_by_name: null,
    ...overrides,
  };
}

function makeCondition(overrides: Partial<ConditionRow> = {}): ConditionRow {
  return {
    local_uuid: 'condition-1',
    user_id: 0,
    server_id: null,
    sync_status: 'synced',
    deleted_locally: 0,
    updated_at_local: '2026-01-01T00:00:00.000Z',
    description: 'Occasional migraines',
    ...overrides,
  };
}

function makeMedication(overrides: Partial<MedicationRow> = {}): MedicationRow {
  return {
    local_uuid: 'medication-1',
    user_id: 0,
    server_id: null,
    sync_status: 'synced',
    deleted_locally: 0,
    updated_at_local: '2026-01-01T00:00:00.000Z',
    name: 'Aspirin',
    dosage: '100mg',
    frequency: 'Once daily',
    notes: null,
    ...overrides,
  } as MedicationRow;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPrivateKeypair.mockResolvedValue({ publicKey: new Uint8Array(), privateKey: new Uint8Array() });
  mockGetAllAllergies.mockResolvedValue([]);
  mockGetAllConditions.mockResolvedValue([]);
  mockGetAllDiagnoses.mockResolvedValue([]);
  mockGetAllMedications.mockResolvedValue([]);
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
    expect(allergiesRepo.createLocal).not.toHaveBeenCalled();
    expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedAllergyLocalUuid: null }));
  });

  it('creates a new allergy from the verification when there is no name match', async () => {
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
    (allergiesRepo.createLocal as jest.Mock).mockResolvedValue('allergy-new');

    await processEnvelope(makeEnvelope());

    expect(allergiesRepo.createLocal).toHaveBeenCalledWith({
      allergen: 'Something Unrecorded',
      reaction: undefined,
      severity: 'mild',
    });
    expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedAllergyLocalUuid: 'allergy-new' }));
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

  it('merges and auto-matches a condition_verification envelope with exactly one case-insensitive description match', async () => {
    mockUnseal.mockResolvedValue({
      type: 'condition_verification',
      version: 1,
      description: 'Occasional Migraines',
      verified_by: { user_id: 1, name: 'Dr. Reyes' },
      verified_at: '2026-01-01T00:00:00.000Z',
    });
    mockGetAllConditions.mockResolvedValue([makeCondition({ local_uuid: 'condition-1', description: 'occasional migraines' })]);

    const result = await processEnvelope(makeEnvelope({ envelope_type: 'condition_verification' }));

    expect(result).toBe('merged');
    expect(conditionsRepo.createLocal).not.toHaveBeenCalled();
    expect(mockInsertAttestation).toHaveBeenCalledWith(
      expect.objectContaining({ matchedConditionLocalUuid: 'condition-1', sourceEnvelopeLocalId: 'env-1' }),
    );
  });

  it('stores an ambiguous match (two conditions with the same description) unmatched rather than guessing', async () => {
    mockUnseal.mockResolvedValue({
      type: 'condition_verification',
      version: 1,
      description: 'Occasional migraines',
      verified_by: { user_id: 1, name: 'Dr. Reyes' },
      verified_at: '2026-01-01T00:00:00.000Z',
    });
    mockGetAllConditions.mockResolvedValue([
      makeCondition({ local_uuid: 'condition-1', description: 'Occasional migraines' }),
      makeCondition({ local_uuid: 'condition-2', description: 'Occasional migraines' }),
    ]);

    const result = await processEnvelope(makeEnvelope({ envelope_type: 'condition_verification' }));

    expect(result).toBe('merged');
    expect(conditionsRepo.createLocal).not.toHaveBeenCalled();
    expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedConditionLocalUuid: null }));
  });

  it('creates a new condition from the verification when there is no description match', async () => {
    mockUnseal.mockResolvedValue({
      type: 'condition_verification',
      version: 1,
      description: 'Something unrecorded',
      verified_by: { user_id: 1, name: 'Dr. Reyes' },
      verified_at: '2026-01-01T00:00:00.000Z',
    });
    (conditionsRepo.createLocal as jest.Mock).mockResolvedValue('condition-new');

    await processEnvelope(makeEnvelope({ envelope_type: 'condition_verification' }));

    expect(conditionsRepo.createLocal).toHaveBeenCalledWith({ description: 'Something unrecorded' });
    expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedConditionLocalUuid: 'condition-new' }));
  });

  it('never attempts a condition match for non-condition envelope types', async () => {
    mockUnseal.mockResolvedValue({
      type: 'general_note',
      version: 1,
      note: 'hello',
      author: { user_id: 1, name: 'Dr. Reyes' },
      created_at: '2026-01-01T00:00:00.000Z',
    });

    await processEnvelope(makeEnvelope({ envelope_type: 'general_note' }));

    expect(mockGetAllConditions).not.toHaveBeenCalled();
    expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedConditionLocalUuid: null }));
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
    expect(diagnosesRepo.createLocal).not.toHaveBeenCalled();
    expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedDiagnosisLocalUuid: null }));
  });

  it('creates a new diagnosis from the verification when there is no condition match', async () => {
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
    (diagnosesRepo.createLocal as jest.Mock).mockResolvedValue('diagnosis-new');

    await processEnvelope(makeEnvelope({ envelope_type: 'diagnosis_verification' }));

    expect(diagnosesRepo.createLocal).toHaveBeenCalledWith({
      condition: 'Something Unrecorded',
      date_of_diagnosis: undefined,
      severity: 'acute',
    });
    expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedDiagnosisLocalUuid: 'diagnosis-new' }));
  });

  it('merges and auto-matches a medication_verification envelope with exactly one case-insensitive name match', async () => {
    mockUnseal.mockResolvedValue({
      type: 'medication_verification',
      version: 1,
      name: 'aspirin',
      dosage: '200mg',
      frequency: 'Twice daily',
      notes: null,
      verified_by: { user_id: 1, name: 'Dr. Reyes' },
      verified_at: '2026-01-01T00:00:00.000Z',
    });
    mockGetAllMedications.mockResolvedValue([makeMedication({ local_uuid: 'medication-1', name: 'Aspirin' })]);
    const envelope = makeEnvelope({ envelope_type: 'medication_verification' });

    const result = await processEnvelope(envelope);

    expect(result).toBe('merged');
    expect(medicationsRepo.updateLocal).toHaveBeenCalledWith('medication-1', {
      dosage: '200mg',
      frequency: 'Twice daily',
      notes: undefined,
    });
    expect(mockInsertAttestation).toHaveBeenCalledWith(
      expect.objectContaining({ matchedMedicationLocalUuid: 'medication-1', sourceEnvelopeLocalId: 'env-1' }),
    );
    expect(pendingSyncEnvelopeRepo.markMerged).toHaveBeenCalledWith('env-1');
  });

  it('stores an ambiguous medication match (two medications with the same name) unmatched rather than guessing', async () => {
    mockUnseal.mockResolvedValue({
      type: 'medication_verification',
      version: 1,
      name: 'Aspirin',
      dosage: '100mg',
      frequency: 'Once daily',
      notes: null,
      verified_by: { user_id: 1, name: 'Dr. Reyes' },
      verified_at: '2026-01-01T00:00:00.000Z',
    });
    mockGetAllMedications.mockResolvedValue([
      makeMedication({ local_uuid: 'medication-1', name: 'Aspirin' }),
      makeMedication({ local_uuid: 'medication-2', name: 'Aspirin' }),
    ]);

    const result = await processEnvelope(makeEnvelope({ envelope_type: 'medication_verification' }));

    expect(result).toBe('merged');
    expect(medicationsRepo.updateLocal).not.toHaveBeenCalled();
    expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedMedicationLocalUuid: null }));
  });

  it('creates a new medication when there is no name match', async () => {
    mockUnseal.mockResolvedValue({
      type: 'medication_verification',
      version: 1,
      name: 'Ibuprofen',
      dosage: '200mg',
      frequency: 'As needed',
      notes: 'For pain',
      verified_by: { user_id: 1, name: 'Dr. Reyes' },
      verified_at: '2026-01-01T00:00:00.000Z',
    });
    mockGetAllMedications.mockResolvedValue([makeMedication({ local_uuid: 'medication-1', name: 'Aspirin' })]);
    (medicationsRepo.createLocal as jest.Mock).mockResolvedValue('medication-new');

    await processEnvelope(makeEnvelope({ envelope_type: 'medication_verification' }));

    expect(medicationsRepo.createLocal).toHaveBeenCalledWith({
      name: 'Ibuprofen',
      dosage: '200mg',
      frequency: 'As needed',
      notes: 'For pain',
    });
    expect(mockInsertAttestation).toHaveBeenCalledWith(
      expect.objectContaining({ matchedMedicationLocalUuid: 'medication-new' }),
    );
  });

  it('never attempts a medication match for non-medication envelope types', async () => {
    mockUnseal.mockResolvedValue({
      type: 'general_note',
      version: 1,
      note: 'hello',
      author: { user_id: 1, name: 'Dr. Reyes' },
      created_at: '2026-01-01T00:00:00.000Z',
    });

    await processEnvelope(makeEnvelope({ envelope_type: 'general_note' }));

    expect(mockGetAllMedications).not.toHaveBeenCalled();
    expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedMedicationLocalUuid: null }));
  });

  describe('__unverify__ / __delete__ note conventions', () => {
    it('__unverify__ on a matched allergy links the attestation without touching the record', async () => {
      mockUnseal.mockResolvedValue({
        type: 'allergy_verification',
        version: 1,
        allergen: 'Penicillin',
        reaction: null,
        severity: 'severe',
        verified_by: { user_id: 1, name: 'Dr. Reyes' },
        verified_at: '2026-01-01T00:00:00.000Z',
        note: '__unverify__',
      });
      mockGetAllAllergies.mockResolvedValue([{ local_uuid: 'allergy-1', allergen: 'Penicillin' } as AllergyRow]);

      await processEnvelope(makeEnvelope());

      expect(allergiesRepo.updateLocal).not.toHaveBeenCalled();
      expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedAllergyLocalUuid: 'allergy-1' }));
    });

    it('__unverify__ with no matched allergy returns null and creates nothing', async () => {
      mockUnseal.mockResolvedValue({
        type: 'allergy_verification',
        version: 1,
        allergen: 'Unrecorded',
        reaction: null,
        severity: 'mild',
        verified_by: { user_id: 1, name: 'Dr. Reyes' },
        verified_at: '2026-01-01T00:00:00.000Z',
        note: '__unverify__',
      });

      await processEnvelope(makeEnvelope());

      expect(allergiesRepo.createLocal).not.toHaveBeenCalled();
      expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedAllergyLocalUuid: null }));
    });

    it('__unverify__ on a matched medication links the attestation without touching the record', async () => {
      mockUnseal.mockResolvedValue({
        type: 'medication_verification',
        version: 1,
        name: 'Aspirin',
        dosage: '100mg',
        frequency: 'Once daily',
        notes: null,
        verified_by: { user_id: 1, name: 'Dr. Reyes' },
        verified_at: '2026-01-01T00:00:00.000Z',
        note: '__unverify__',
      });
      mockGetAllMedications.mockResolvedValue([makeMedication({ local_uuid: 'medication-1' })]);

      await processEnvelope(makeEnvelope({ envelope_type: 'medication_verification' }));

      expect(medicationsRepo.updateLocal).not.toHaveBeenCalled();
      expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedMedicationLocalUuid: 'medication-1' }));
    });

    it('__delete__ on a matched medication deletes the record and links the attestation to it', async () => {
      mockUnseal.mockResolvedValue({
        type: 'medication_verification',
        version: 1,
        name: 'Aspirin',
        dosage: '100mg',
        frequency: 'Once daily',
        notes: null,
        verified_by: { user_id: 1, name: 'Dr. Reyes' },
        verified_at: '2026-01-01T00:00:00.000Z',
        note: '__delete__',
      });
      mockGetAllMedications.mockResolvedValue([makeMedication({ local_uuid: 'medication-1' })]);

      await processEnvelope(makeEnvelope({ envelope_type: 'medication_verification' }));

      expect(medicationsRepo.deleteLocal).toHaveBeenCalledWith('medication-1');
      expect(medicationsRepo.createLocal).not.toHaveBeenCalled();
      expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedMedicationLocalUuid: 'medication-1' }));
    });

    it('__delete__ with no matched medication deletes nothing and returns null', async () => {
      mockUnseal.mockResolvedValue({
        type: 'medication_verification',
        version: 1,
        name: 'Unrecorded',
        dosage: '100mg',
        frequency: 'Once daily',
        notes: null,
        verified_by: { user_id: 1, name: 'Dr. Reyes' },
        verified_at: '2026-01-01T00:00:00.000Z',
        note: '__delete__',
      });

      await processEnvelope(makeEnvelope({ envelope_type: 'medication_verification' }));

      expect(medicationsRepo.deleteLocal).not.toHaveBeenCalled();
      expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedMedicationLocalUuid: null }));
    });

    it('__unverify__ on a matched condition links the attestation without touching the record', async () => {
      mockUnseal.mockResolvedValue({
        type: 'condition_verification',
        version: 1,
        description: 'Occasional migraines',
        verified_by: { user_id: 1, name: 'Dr. Reyes' },
        verified_at: '2026-01-01T00:00:00.000Z',
        note: '__unverify__',
      });
      mockGetAllConditions.mockResolvedValue([makeCondition({ local_uuid: 'condition-1' })]);

      await processEnvelope(makeEnvelope({ envelope_type: 'condition_verification' }));

      expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedConditionLocalUuid: 'condition-1' }));
    });

    it('__delete__ on a matched condition deletes the record and links the attestation to it', async () => {
      mockUnseal.mockResolvedValue({
        type: 'condition_verification',
        version: 1,
        description: 'Occasional migraines',
        verified_by: { user_id: 1, name: 'Dr. Reyes' },
        verified_at: '2026-01-01T00:00:00.000Z',
        note: '__delete__',
      });
      mockGetAllConditions.mockResolvedValue([makeCondition({ local_uuid: 'condition-1' })]);

      await processEnvelope(makeEnvelope({ envelope_type: 'condition_verification' }));

      expect(conditionsRepo.deleteLocal).toHaveBeenCalledWith('condition-1');
      expect(conditionsRepo.createLocal).not.toHaveBeenCalled();
      expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedConditionLocalUuid: 'condition-1' }));
    });

    it('__delete__ with no matched condition deletes nothing and returns null', async () => {
      mockUnseal.mockResolvedValue({
        type: 'condition_verification',
        version: 1,
        description: 'Unrecorded',
        verified_by: { user_id: 1, name: 'Dr. Reyes' },
        verified_at: '2026-01-01T00:00:00.000Z',
        note: '__delete__',
      });

      await processEnvelope(makeEnvelope({ envelope_type: 'condition_verification' }));

      expect(conditionsRepo.deleteLocal).not.toHaveBeenCalled();
      expect(mockInsertAttestation).toHaveBeenCalledWith(expect.objectContaining({ matchedConditionLocalUuid: null }));
    });
  });
});
