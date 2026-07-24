import * as Crypto from 'expo-crypto';

import * as pendingSyncEnvelopeRepo from '@/db/repositories/pending-sync-envelope.repo';
import * as professionalAttestationRepo from '@/db/repositories/professional-attestation.repo';
import * as allergiesRepo from '@/db/repositories/allergies.repo';
import * as conditionsRepo from '@/db/repositories/conditions.repo';
import * as diagnosesRepo from '@/db/repositories/diagnoses.repo';
import * as medicationsRepo from '@/db/repositories/medications.repo';
import * as medicalInformationRepo from '@/db/repositories/medical-information.repo';
import { unseal } from '@/services/sealed-box.service';
import { getPrivateKeypair } from '@/services/device-key.service';
import { parseEnvelopePlaintext } from '@/lib/envelope-schema';
import { queryClient } from '@/lib/query-client';
import { allergiesQueryKey, conditionsQueryKey, diagnosesQueryKey, medicationsQueryKey, medicalInformationQueryKey, attestationsQueryKey } from '@/lib/query-keys';
import type { AllergyVerificationEnvelope, ConditionVerificationEnvelope, DiagnosisVerificationEnvelope, MedicationVerificationEnvelope } from '@/lib/envelope-schema';
import type { PendingSyncEnvelopeRow, VerifiedByEntry } from '@/db/schema';
import type { EnvelopeType } from '@/api/types';

const TAG = '[MergeService]';

export type ProcessEnvelopeResult = 'merged' | 'decrypt_failed' | 'expired';

async function createOrUpdateOrDeleteAllergy(allergy: AllergyVerificationEnvelope): Promise<string | null> {
  console.debug(TAG, 'Processing allergy verification', { allergen: allergy.allergen, verifiedBy: allergy.verified_by });
  const existingAllergies = await allergiesRepo.getAll();
  const matches = existingAllergies.filter(
    (a) => a.allergen.trim().toLowerCase() === allergy.allergen.trim().toLowerCase(),
  );
  // Ambiguous (>1 same-name records) is treated the same as no match: leave unmatched rather than
  // guessing which record the professional meant, and never create a duplicate in that case either.
  if (matches.length > 1) {
    console.debug(TAG, 'Ambiguous allergy match, skipping', { allergen: allergy.allergen, matchCount: matches.length });
    return null;
  }
  const match = matches[0];

  if (allergy.note === '__delete__') {
    if (match) {
      console.debug(TAG, 'Deleting allergy', { localUuid: match.local_uuid });
      await allergiesRepo.deleteLocal(match.local_uuid);
      return match.local_uuid;
    }
    return null;
  }

  /* A professional revoking their own earlier verification — just needs to be linked to the
     matched record so the dashboard's verified-count can drop them from the latest-per-professional
     tally; the record's fields are left untouched. */
  if (allergy.note === '__unverify__') {
    if (match) {
      console.debug(TAG, 'Revoking allergy verification', { localUuid: match.local_uuid, userId: allergy.verified_by.user_id });
      await allergiesRepo.removeVerifiedBy(match.local_uuid, allergy.verified_by.user_id);
      return match.local_uuid;
    }
    return null;
  }

  if (match) {
    console.debug(TAG, 'Updating existing allergy', { localUuid: match.local_uuid });
    await allergiesRepo.updateLocal(match.local_uuid, {
      severity: allergy.severity,
      reaction: allergy.reaction ?? undefined,
    });
    // Update verified_by
    const verifiedEntry: VerifiedByEntry = {
      user_id: allergy.verified_by.user_id,
      name: allergy.verified_by.name,
      verified_at: allergy.verified_at,
    };
    await allergiesRepo.updateVerifiedBy(match.local_uuid, verifiedEntry);
    return match.local_uuid;
  }

  console.debug(TAG, 'Creating new allergy', { allergen: allergy.allergen });
  const newUuid = await allergiesRepo.createLocal({
    allergen: allergy.allergen,
    reaction: allergy.reaction ?? undefined,
    severity: allergy.severity,
  });
  // Update verified_by on new record
  const verifiedEntry: VerifiedByEntry = {
    user_id: allergy.verified_by.user_id,
    name: allergy.verified_by.name,
    verified_at: allergy.verified_at,
  };
  await allergiesRepo.updateVerifiedBy(newUuid, verifiedEntry);
  return newUuid;
}

async function createOrUpdateOrDeleteCondition(condition: ConditionVerificationEnvelope): Promise<string | null> {
  console.debug(TAG, 'Processing condition verification', { description: condition.description, verifiedBy: condition.verified_by });
  const existingConditions = await conditionsRepo.getAll();
  const matches = existingConditions.filter(
    (c) => c.description.trim().toLowerCase() === condition.description.trim().toLowerCase(),
  );
  if (matches.length > 1) {
    console.debug(TAG, 'Ambiguous condition match, skipping', { description: condition.description, matchCount: matches.length });
    return null;
  }
  const match = matches[0];

  if (condition.note === '__delete__') {
    if (match) {
      console.debug(TAG, 'Deleting condition', { localUuid: match.local_uuid });
      await conditionsRepo.deleteLocal(match.local_uuid);
      return match.local_uuid;
    }
    return null;
  }

  if (condition.note === '__unverify__') {
    if (match) {
      console.debug(TAG, 'Revoking condition verification', { localUuid: match.local_uuid, userId: condition.verified_by.user_id });
      await conditionsRepo.removeVerifiedBy(match.local_uuid, condition.verified_by.user_id);
      return match.local_uuid;
    }
    return null;
  }

  if (match) {
    console.debug(TAG, 'Existing condition found', { localUuid: match.local_uuid });
    // Update verified_by
    const verifiedEntry: VerifiedByEntry = {
      user_id: condition.verified_by.user_id,
      name: condition.verified_by.name,
      verified_at: condition.verified_at,
    };
    await conditionsRepo.updateVerifiedBy(match.local_uuid, verifiedEntry);
    return match.local_uuid;
  }

  console.debug(TAG, 'Creating new condition', { description: condition.description });
  const newUuid = await conditionsRepo.createLocal({
    description: condition.description,
  });
  // Update verified_by on new record
  const verifiedEntry: VerifiedByEntry = {
    user_id: condition.verified_by.user_id,
    name: condition.verified_by.name,
    verified_at: condition.verified_at,
  };
  await conditionsRepo.updateVerifiedBy(newUuid, verifiedEntry);
  return newUuid;
}

async function createOrUpdateOrDeleteDiagnosis(diagnosis: DiagnosisVerificationEnvelope): Promise<string | null> {
  console.debug(TAG, 'Processing diagnosis verification', { condition: diagnosis.condition, verifiedBy: diagnosis.verified_by });
  const existingDiagnoses = await diagnosesRepo.getAll();
  const matches = existingDiagnoses.filter(
    (d) => d.condition.trim().toLowerCase() === diagnosis.condition.trim().toLowerCase(),
  );
  if (matches.length > 1) {
    console.debug(TAG, 'Ambiguous diagnosis match, skipping', { condition: diagnosis.condition, matchCount: matches.length });
    return null;
  }
  const match = matches[0];

  if (diagnosis.note === '__delete__') {
    if (match) {
      console.debug(TAG, 'Deleting diagnosis', { localUuid: match.local_uuid });
      await diagnosesRepo.deleteLocal(match.local_uuid);
      return match.local_uuid;
    }
    return null;
  }

  if (diagnosis.note === '__unverify__') {
    if (match) {
      console.debug(TAG, 'Revoking diagnosis verification', { localUuid: match.local_uuid, userId: diagnosis.verified_by.user_id });
      await diagnosesRepo.removeVerifiedBy(match.local_uuid, diagnosis.verified_by.user_id);
      return match.local_uuid;
    }
    return null;
  }

  if (match) {
    console.debug(TAG, 'Updating existing diagnosis', { localUuid: match.local_uuid });
    await diagnosesRepo.updateLocal(match.local_uuid, {
      severity: diagnosis.severity,
      date_of_diagnosis: diagnosis.date_of_diagnosis ?? undefined,
    });
    // Update verified_by
    const verifiedEntry: VerifiedByEntry = {
      user_id: diagnosis.verified_by.user_id,
      name: diagnosis.verified_by.name,
      verified_at: diagnosis.verified_at,
    };
    await diagnosesRepo.updateVerifiedBy(match.local_uuid, verifiedEntry);
    return match.local_uuid;
  }

  console.debug(TAG, 'Creating new diagnosis', { condition: diagnosis.condition });
  const newUuid = await diagnosesRepo.createLocal({
    condition: diagnosis.condition,
    date_of_diagnosis: diagnosis.date_of_diagnosis ?? undefined,
    severity: diagnosis.severity,
  });
  // Update verified_by on new record
  const verifiedEntry: VerifiedByEntry = {
    user_id: diagnosis.verified_by.user_id,
    name: diagnosis.verified_by.name,
    verified_at: diagnosis.verified_at,
  };
  await diagnosesRepo.updateVerifiedBy(newUuid, verifiedEntry);
  return newUuid;
}

async function createOrUpdateOrDeleteMedication(medication: MedicationVerificationEnvelope): Promise<string | null> {
  console.debug(TAG, 'Processing medication verification', { name: medication.name, verifiedBy: medication.verified_by });
  const existingMedications = await medicationsRepo.getAll();
  const matches = existingMedications.filter(
    (m) => m.name.trim().toLowerCase() === medication.name.trim().toLowerCase(),
  );
  if (matches.length > 1) {
    console.debug(TAG, 'Ambiguous medication match, skipping', { name: medication.name, matchCount: matches.length });
    return null;
  }
  const match = matches[0];

  if (medication.note === '__delete__') {
    if (match) {
      console.debug(TAG, 'Deleting medication', { localUuid: match.local_uuid });
      await medicationsRepo.deleteLocal(match.local_uuid);
      return match.local_uuid;
    }
    return null;
  }

  if (medication.note === '__unverify__') {
    if (match) {
      console.debug(TAG, 'Revoking medication verification', { localUuid: match.local_uuid, userId: medication.verified_by.user_id });
      await medicationsRepo.removeVerifiedBy(match.local_uuid, medication.verified_by.user_id);
      return match.local_uuid;
    }
    return null;
  }

  if (match) {
    console.debug(TAG, 'Updating existing medication', { localUuid: match.local_uuid });
    await medicationsRepo.updateLocal(match.local_uuid, {
      dosage: medication.dosage,
      frequency: medication.frequency,
      notes: medication.notes ?? undefined,
    });
    // Update verified_by
    const verifiedEntry: VerifiedByEntry = {
      user_id: medication.verified_by.user_id,
      name: medication.verified_by.name,
      verified_at: medication.verified_at,
    };
    await medicationsRepo.updateVerifiedBy(match.local_uuid, verifiedEntry);
    return match.local_uuid;
  }

  console.debug(TAG, 'Creating new medication', { name: medication.name });
  const newUuid = await medicationsRepo.createLocal({
    name: medication.name,
    dosage: medication.dosage,
    frequency: medication.frequency,
    notes: medication.notes ?? undefined,
  });
  // Update verified_by on new record
  const verifiedEntry: VerifiedByEntry = {
    user_id: medication.verified_by.user_id,
    name: medication.verified_by.name,
    verified_at: medication.verified_at,
  };
  await medicationsRepo.updateVerifiedBy(newUuid, verifiedEntry);
  return newUuid;
}

/**
 * Decrypts, validates, and merges a single envelope, regardless of whether it arrived via the relay or
 * BLE — both write into the same `pending_sync_envelopes` inbox first, so this
 * is the one place that turns a decrypted envelope into local state.
 */
export async function processEnvelope(envelope: PendingSyncEnvelopeRow): Promise<ProcessEnvelopeResult> {
  console.debug(TAG, 'Processing envelope', { localId: envelope.local_id, envelopeType: envelope.envelope_type, transport: envelope.transport });

  if (envelope.expires_at && new Date(envelope.expires_at).getTime() < Date.now()) {
    console.debug(TAG, 'Envelope expired', { localId: envelope.local_id, expiresAt: envelope.expires_at });
    await pendingSyncEnvelopeRepo.markExpired(envelope.local_id);
    return 'expired';
  }

  const keypair = await getPrivateKeypair();
  const plaintext = await unseal<unknown>(envelope.ciphertext, keypair);
  if (plaintext === null) {
    console.warn(TAG, 'Failed to decrypt envelope', { localId: envelope.local_id });
    await pendingSyncEnvelopeRepo.markDecryptFailed(envelope.local_id, 'unseal_failed');
    return 'decrypt_failed';
  }

  const parsed = parseEnvelopePlaintext(envelope.envelope_type as EnvelopeType, plaintext);
  if (parsed === null) {
    console.warn(TAG, 'Envelope schema validation failed', { localId: envelope.local_id, envelopeType: envelope.envelope_type });
    await pendingSyncEnvelopeRepo.markDecryptFailed(envelope.local_id, 'schema_validation_failed');
    return 'decrypt_failed';
  }

  console.debug(TAG, 'Envelope decrypted successfully', { localId: envelope.local_id, type: parsed.type });
  await pendingSyncEnvelopeRepo.markDecrypted(envelope.local_id);

  const matchedAllergyLocalUuid = parsed.type === 'allergy_verification'
    ? await createOrUpdateOrDeleteAllergy(parsed)
    : null;
  const matchedConditionLocalUuid = parsed.type === 'condition_verification'
    ? await createOrUpdateOrDeleteCondition(parsed)
    : null;
  const matchedDiagnosisLocalUuid = parsed.type === 'diagnosis_verification'
    ? await createOrUpdateOrDeleteDiagnosis(parsed)
    : null;
  const matchedMedicationLocalUuid = parsed.type === 'medication_verification'
    ? await createOrUpdateOrDeleteMedication(parsed)
    : null;

  console.debug(TAG, 'Record matching results', {
    allergy: matchedAllergyLocalUuid,
    condition: matchedConditionLocalUuid,
    diagnosis: matchedDiagnosisLocalUuid,
    medication: matchedMedicationLocalUuid,
  });

  await professionalAttestationRepo.insert({
    localId: Crypto.randomUUID(),
    sourceEnvelopeLocalId: envelope.local_id,
    envelopeType: envelope.envelope_type,
    payload: parsed,
    matchedAllergyLocalUuid,
    matchedConditionLocalUuid,
    matchedDiagnosisLocalUuid,
    matchedMedicationLocalUuid,
  });
  console.debug(TAG, 'Attestation stored', { envelopeType: envelope.envelope_type });

  if (parsed.type === 'medical_information_update') {
    console.debug(TAG, 'Applying medical information update');
    await medicalInformationRepo.applyProfessionalUpdate(parsed.fields);
  }

  await pendingSyncEnvelopeRepo.markMerged(envelope.local_id);
  console.debug(TAG, 'Envelope merged successfully', { localId: envelope.local_id });

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: allergiesQueryKey }),
    queryClient.invalidateQueries({ queryKey: conditionsQueryKey }),
    queryClient.invalidateQueries({ queryKey: diagnosesQueryKey }),
    queryClient.invalidateQueries({ queryKey: medicationsQueryKey }),
    queryClient.invalidateQueries({ queryKey: medicalInformationQueryKey }),
    queryClient.invalidateQueries({ queryKey: attestationsQueryKey }),
  ]);

  return 'merged';
}
