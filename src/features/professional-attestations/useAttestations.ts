import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/auth/useAuth';
import * as professionalAttestationRepo from '@/db/repositories/professional-attestation.repo';
import type { AllergyVerificationEnvelope, DiagnosisVerificationEnvelope, GeneralNoteEnvelope, TransfusionWitnessEnvelope } from '@/lib/envelope-schema';

export const attestationsQueryKey = ['professional-attestations'] as const;

type AttestationPayload = AllergyVerificationEnvelope | DiagnosisVerificationEnvelope | TransfusionWitnessEnvelope | GeneralNoteEnvelope;

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
