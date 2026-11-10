import { useAuth } from '@/auth/useAuth';
import { useAllergies } from '@/features/allergies/useAllergies';
import { useConditions } from '@/features/conditions/useConditions';
import { useDiagnoses } from '@/features/diagnoses/useDiagnoses';
import { useEmergencyContacts } from '@/features/emergency-contacts';
import { useMedicalInformation } from '@/features/medical-information/useMedicalInformation';
import { useMedications } from '@/features/medications/useMedications';
import { useOnboardingChecklist } from '@/onboarding/useOnboardingChecklist';

/**
 * Single hook that fetches all data needed for the onboarding checklist.
 * Use in both the home screen and onboarding-tasks screen to avoid duplication.
 */
export function useOnboardingData() {
  const { user } = useAuth();
  const { data: allergies } = useAllergies();
  const { data: conditions } = useConditions();
  const { data: diagnoses } = useDiagnoses();
  const { data: medications } = useMedications();
  const { data: emergencyContacts } = useEmergencyContacts();
  const { data: medicalInformation, isLoading: isMedicalInformationLoading } = useMedicalInformation();

  const isDataReady =
    medicalInformation !== undefined &&
    allergies !== undefined &&
    conditions !== undefined &&
    diagnoses !== undefined &&
    medications !== undefined &&
    emergencyContacts !== undefined;

  const checklist = useOnboardingChecklist({
    userId: user?.id,
    emailVerified: !!user?.email_verified_at,
    hasEmergencyContacts: (emergencyContacts?.length ?? 0) > 0,
    hasAllergies: (allergies?.length ?? 0) > 0,
    hasConditions: (conditions?.length ?? 0) > 0,
    hasMedications: (medications?.length ?? 0) > 0,
  });

  return {
    allergies: allergies ?? [],
    conditions: conditions ?? [],
    diagnoses: diagnoses ?? [],
    medications: medications ?? [],
    emergencyContacts: emergencyContacts ?? [],
    medicalInformation,
    isMedicalInformationLoading,
    isDataReady,
    checklist,
  };
}
