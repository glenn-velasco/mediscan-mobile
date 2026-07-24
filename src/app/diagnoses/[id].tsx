import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAuth } from '@/auth/useAuth';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { AppLayout } from '@/components/layouts/app-layout';
import { TextField } from '@/components/form/text-field';
import { PickerField } from '@/components/form/picker-field';
import { DateField } from '@/components/form/date-field';
import { PrimaryButton } from '@/components/primary-button';
import { ConflictBanner } from '@/components/conflict-banner';
import { Card } from '@/components/card';
import { VerifiedCountBadge } from '@/components/verified-count-badge';
import { useDiagnoses } from '@/features/diagnoses/useDiagnoses';
import { useUpdateDiagnosis } from '@/features/diagnoses/useUpdateDiagnosis';
import { useDeleteDiagnosis } from '@/features/diagnoses/useDeleteDiagnosis';
import { useAttestationsForDiagnosis } from '@/features/professional-attestations/useAttestations';
import { DIAGNOSIS_SEVERITY_OPTIONS, type DiagnosisSeverity } from '@/constants/diagnosis-severity';

export default function EditDiagnosisScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const isVerifiedProfessional = user?.permissions?.includes('verified professional') ?? false;
  const { data: diagnoses = [] } = useDiagnoses();
  const { mutateAsync: updateDiagnosis, isPending: isSaving } = useUpdateDiagnosis();
  const { mutateAsync: deleteDiagnosis, isPending: isDeleting } = useDeleteDiagnosis();
  const { data: attestations = [] } = useAttestationsForDiagnosis(id);

  const existing = diagnoses.find((d) => d.local_uuid === id);

  const [condition, setCondition] = useState('');
  const [dateOfDiagnosis, setDateOfDiagnosis] = useState('');
  const [severity, setSeverity] = useState<DiagnosisSeverity>('chronic');

  const verifiedCount = useMemo(
    () => attestations.filter((a) => a.envelope_type === 'diagnosis_verification').length,
    [attestations],
  );

  useEffect(() => {
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time seed of edit form state once the queried record loads
      setCondition(existing.condition);
      setDateOfDiagnosis(existing.date_of_diagnosis ?? '');
      setSeverity(existing.severity);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-seed only when switching records, not on every background refetch
  }, [existing?.local_uuid]);

  if (!existing) {
    return (
      <ThemedView className="flex-1 items-center justify-center px-6">
        <ThemedText>This diagnosis is no longer available.</ThemedText>
      </ThemedView>
    );
  }

  const onSave = async () => {
    await updateDiagnosis({
      localUuid: existing.local_uuid,
      payload: { condition, date_of_diagnosis: dateOfDiagnosis || undefined, severity },
    });
    router.back();
  };

  const onDelete = async () => {
    await deleteDiagnosis(existing.local_uuid);
    router.back();
  };

  return (
    <AppLayout avoidKeyboard>
      {existing.sync_status === 'conflict' || existing.sync_status === 'failed' ? (
        <ConflictBanner message="This couldn't be saved. Check sync status for details." className="mb-4" />
      ) : null}

      {existing.diagnosed_by_name ? (
        <ThemedText type="small" color="mutedForeground" className="mb-2">
          Diagnosed by {existing.diagnosed_by_name}
        </ThemedText>
      ) : null}

      <TextField label="Condition" value={condition} onChangeText={setCondition} editable={isVerifiedProfessional} />
      <DateField label="Date of diagnosis" value={dateOfDiagnosis} onChange={setDateOfDiagnosis} maximumDate={new Date()} disabled={!isVerifiedProfessional} />
      <PickerField label="Severity" options={DIAGNOSIS_SEVERITY_OPTIONS} value={severity} onChange={setSeverity} disabled={!isVerifiedProfessional} />

      <Card className="mb-6 flex-row items-center justify-between">
        <ThemedText type="smallBold" color="mutedForeground">
          Verified by professionals
        </ThemedText>
        <VerifiedCountBadge count={verifiedCount} />
      </Card>

      {isVerifiedProfessional ? (
        <>
          <PrimaryButton label="Save" loading={isSaving} onPress={onSave} disabled={isDeleting} className="mb-2" />
          <PrimaryButton label="Delete diagnosis" variant="danger" loading={isDeleting} onPress={onDelete} disabled={isSaving} />
        </>
      ) : null}
    </AppLayout>
  );
}
