import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/auth/useAuth';
import * as professionalAttestationRepo from '@/db/repositories/professional-attestation.repo';
import { attestationsQueryKey } from '@/lib/query-keys';
import type { AllergyVerificationEnvelope, DiagnosisVerificationEnvelope, MedicationVerificationEnvelope, GeneralNoteEnvelope, TransfusionWitnessEnvelope } from '@/lib/envelope-schema';

export { attestationsQueryKey };

type AttestationPayload = AllergyVerificationEnvelope | DiagnosisVerificationEnvelope | MedicationVerificationEnvelope | TransfusionWitnessEnvelope | GeneralNoteEnvelope;

export function useAttestations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...attestationsQueryKey, user?.id],
    queryFn: () => professionalAttestationRepo.getAll<AttestationPayload>(),
    enabled: !!user,
  });
}

/** Confirmed attestations for one allergy — annotations like "Verified by Dr. X", never overwrites patient-authored fields. */
export function useAttestationsForAllergy(allergyLocalUuid: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...attestationsQueryKey, user?.id, 'for-allergy', allergyLocalUuid],
    queryFn: () => professionalAttestationRepo.getForAllergy<AttestationPayload>(allergyLocalUuid!),
    enabled: !!allergyLocalUuid && !!user,
  });
}

/** Confirmed attestations for one diagnosis — annotations, never overwrites patient-authored fields. */
export function useAttestationsForDiagnosis(diagnosisLocalUuid: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...attestationsQueryKey, user?.id, 'for-diagnosis', diagnosisLocalUuid],
    queryFn: () => professionalAttestationRepo.getForDiagnosis<AttestationPayload>(diagnosisLocalUuid!),
    enabled: !!diagnosisLocalUuid && !!user,
  });
}

/** Confirmed attestations for one medication — annotations, never overwrites patient-authored fields. */
export function useAttestationsForMedication(medicationLocalUuid: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...attestationsQueryKey, user?.id, 'for-medication', medicationLocalUuid],
    queryFn: () => professionalAttestationRepo.getForMedication<AttestationPayload>(medicationLocalUuid!),
    enabled: !!medicationLocalUuid && !!user,
  });
}

/** Allergy-verification attestations the merge pipeline couldn't confidently match (ambiguous or no match) — never applied silently, need the patient to pick which allergy it refers to. */
export function useUnconfirmedAttestations() {
  const { data = [], ...rest } = useAttestations();
  const unconfirmed = data.filter(
    (a) => a.envelope_type === 'allergy_verification' && a.matched_allergy_local_uuid === null,
  );
  return { ...rest, data: unconfirmed };
}

/** Diagnosis-verification attestations the merge pipeline couldn't confidently match (ambiguous or no match) — never applied silently, need the patient to pick which diagnosis it refers to. */
export function useUnconfirmedDiagnosisAttestations() {
  const { data = [], ...rest } = useAttestations();
  const unconfirmed = data.filter(
    (a) => a.envelope_type === 'diagnosis_verification' && a.matched_diagnosis_local_uuid === null,
  );
  return { ...rest, data: unconfirmed };
}

/** Medication-verification attestations the merge pipeline couldn't confidently match (ambiguous or no match) — never applied silently, need the patient to pick which medication it refers to. */
export function useUnconfirmedMedicationAttestations() {
  const { data = [], ...rest } = useAttestations();
  const unconfirmed = data.filter(
    (a) => a.envelope_type === 'medication_verification' && a.matched_medication_local_uuid === null,
  );
  return { ...rest, data: unconfirmed };
}

export function useConfirmAttestationMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ localId, allergyLocalUuid }: { localId: string; allergyLocalUuid: string }) =>
      professionalAttestationRepo.setMatchedAllergy(localId, allergyLocalUuid),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: attestationsQueryKey });
    },
  });
}

export function useConfirmDiagnosisAttestationMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ localId, diagnosisLocalUuid }: { localId: string; diagnosisLocalUuid: string }) =>
      professionalAttestationRepo.setMatchedDiagnosis(localId, diagnosisLocalUuid),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: attestationsQueryKey });
    },
  });
}

export function useConfirmMedicationAttestationMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ localId, medicationLocalUuid }: { localId: string; medicationLocalUuid: string }) =>
      professionalAttestationRepo.setMatchedMedication(localId, medicationLocalUuid),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: attestationsQueryKey });
    },
  });
}
