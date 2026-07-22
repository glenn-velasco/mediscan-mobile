import * as Crypto from 'expo-crypto';

import * as pendingSyncEnvelopeRepo from '@/db/repositories/pending-sync-envelope.repo';
import * as professionalAttestationRepo from '@/db/repositories/professional-attestation.repo';
import * as allergiesRepo from '@/db/repositories/allergies.repo';
import * as diagnosesRepo from '@/db/repositories/diagnoses.repo';
import * as medicationsRepo from '@/db/repositories/medications.repo';
import * as medicalInformationRepo from '@/db/repositories/medical-information.repo';
import { unseal } from '@/services/sealed-box.service';
import { getPrivateKeypair } from '@/services/device-key.service';
import { parseEnvelopePlaintext } from '@/lib/envelope-schema';
import { queryClient } from '@/lib/query-client';
import { allergiesQueryKey, diagnosesQueryKey, medicationsQueryKey, medicalInformationQueryKey, attestationsQueryKey } from '@/lib/query-keys';
import type { AllergyVerificationEnvelope, DiagnosisVerificationEnvelope, MedicationVerificationEnvelope } from '@/lib/envelope-schema';
import type { PendingSyncEnvelopeRow } from '@/db/schema';
import type { EnvelopeType } from '@/api/types';

export type ProcessEnvelopeResult = 'merged' | 'decrypt_failed' | 'expired';

async function createOrUpdateOrDeleteAllergy(allergy: AllergyVerificationEnvelope): Promise<string | null> {
  const existingAllergies = await allergiesRepo.getAll();
  const matches = existingAllergies.filter(
    (a) => a.allergen.trim().toLowerCase() === allergy.allergen.trim().toLowerCase(),
  );
  // Ambiguous (>1 same-name records) is treated the same as no match: leave unmatched rather than
  // guessing which record the professional meant, and never create a duplicate in that case either.
  if (matches.length > 1) return null;
  const match = matches[0];

  if (allergy.note === '__delete__') {
    if (match) {
      await allergiesRepo.deleteLocal(match.local_uuid);
      return match.local_uuid;
    }
    return null;
  }

  /* A professional revoking their own earlier verification — just needs to be linked to the
     matched record so the dashboard's verified-count can drop them from the latest-per-professional
     tally; the record's fields are left untouched. */
  if (allergy.note === '__unverify__') {
    return match ? match.local_uuid : null;
  }

  if (match) {
    await allergiesRepo.updateLocal(match.local_uuid, {
      severity: allergy.severity,
      reaction: allergy.reaction ?? undefined,
    });
    return match.local_uuid;
  }

  return await allergiesRepo.createLocal({
    allergen: allergy.allergen,
    reaction: allergy.reaction ?? undefined,
    severity: allergy.severity,
  });
}

async function createOrUpdateOrDeleteDiagnosis(diagnosis: DiagnosisVerificationEnvelope): Promise<string | null> {
  const existingDiagnoses = await diagnosesRepo.getAll();
  const matches = existingDiagnoses.filter(
    (d) => d.condition.trim().toLowerCase() === diagnosis.condition.trim().toLowerCase(),
  );
  if (matches.length > 1) return null;
  const match = matches[0];

  if (diagnosis.note === '__delete__') {
    if (match) {
      await diagnosesRepo.deleteLocal(match.local_uuid);
      return match.local_uuid;
    }
    return null;
  }

  if (diagnosis.note === '__unverify__') {
    return match ? match.local_uuid : null;
  }

  if (match) {
    await diagnosesRepo.updateLocal(match.local_uuid, {
      severity: diagnosis.severity,
      date_of_diagnosis: diagnosis.date_of_diagnosis ?? undefined,
    });
    return match.local_uuid;
  }

  return await diagnosesRepo.createLocal({
    condition: diagnosis.condition,
    date_of_diagnosis: diagnosis.date_of_diagnosis ?? undefined,
    severity: diagnosis.severity,
  });
}

async function createOrUpdateOrDeleteMedication(medication: MedicationVerificationEnvelope): Promise<string | null> {
  const existingMedications = await medicationsRepo.getAll();
  const matches = existingMedications.filter(
    (m) => m.name.trim().toLowerCase() === medication.name.trim().toLowerCase(),
  );
  if (matches.length > 1) return null;
  const match = matches[0];

  if (medication.note === '__delete__') {
    if (match) {
      await medicationsRepo.deleteLocal(match.local_uuid);
      return match.local_uuid;
    }
    return null;
  }

  if (medication.note === '__unverify__') {
    return match ? match.local_uuid : null;
  }

  if (match) {
    await medicationsRepo.updateLocal(match.local_uuid, {
      dosage: medication.dosage,
      frequency: medication.frequency,
      notes: medication.notes ?? undefined,
    });
    return match.local_uuid;
  }

  return await medicationsRepo.createLocal({
    name: medication.name,
    dosage: medication.dosage,
    frequency: medication.frequency,
    notes: medication.notes ?? undefined,
  });
}

/**
 * Decrypts, validates, and merges a single envelope, regardless of whether it arrived via the relay or
 * BLE — both write into the same `pending_sync_envelopes` inbox first, so this
 * is the one place that turns a decrypted envelope into local state.
 */
export async function processEnvelope(envelope: PendingSyncEnvelopeRow): Promise<ProcessEnvelopeResult> {
  if (envelope.expires_at && new Date(envelope.expires_at).getTime() < Date.now()) {
    await pendingSyncEnvelopeRepo.markExpired(envelope.local_id);
    return 'expired';
  }

  const keypair = await getPrivateKeypair();
  const plaintext = await unseal<unknown>(envelope.ciphertext, keypair);
  if (plaintext === null) {
    await pendingSyncEnvelopeRepo.markDecryptFailed(envelope.local_id, 'unseal_failed');
    return 'decrypt_failed';
  }

  const parsed = parseEnvelopePlaintext(envelope.envelope_type as EnvelopeType, plaintext);
  if (parsed === null) {
    await pendingSyncEnvelopeRepo.markDecryptFailed(envelope.local_id, 'schema_validation_failed');
    return 'decrypt_failed';
  }

  await pendingSyncEnvelopeRepo.markDecrypted(envelope.local_id);

  const matchedAllergyLocalUuid = parsed.type === 'allergy_verification'
    ? await createOrUpdateOrDeleteAllergy(parsed)
    : null;
  const matchedDiagnosisLocalUuid = parsed.type === 'diagnosis_verification'
    ? await createOrUpdateOrDeleteDiagnosis(parsed)
    : null;
  const matchedMedicationLocalUuid = parsed.type === 'medication_verification'
    ? await createOrUpdateOrDeleteMedication(parsed)
    : null;

  await professionalAttestationRepo.insert({
    localId: Crypto.randomUUID(),
    sourceEnvelopeLocalId: envelope.local_id,
    envelopeType: envelope.envelope_type,
    payload: parsed,
    matchedAllergyLocalUuid,
    matchedDiagnosisLocalUuid,
    matchedMedicationLocalUuid,
  });

  if (parsed.type === 'medical_information_update') {
    await medicalInformationRepo.applyProfessionalUpdate(parsed.fields);
  }

  await pendingSyncEnvelopeRepo.markMerged(envelope.local_id);

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: allergiesQueryKey }),
    queryClient.invalidateQueries({ queryKey: diagnosesQueryKey }),
    queryClient.invalidateQueries({ queryKey: medicationsQueryKey }),
    queryClient.invalidateQueries({ queryKey: medicalInformationQueryKey }),
    queryClient.invalidateQueries({ queryKey: attestationsQueryKey }),
  ]);

  return 'merged';
}
