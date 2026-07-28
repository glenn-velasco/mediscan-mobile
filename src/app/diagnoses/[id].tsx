import { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller, useFormState } from 'react-hook-form';

import { useAuth } from '@/auth/useAuth';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { AppLayout } from '@/components/layouts/app-layout';
import { TextField } from '@/components/form/text-field';
import { SelectField } from '@/components/form/select-field';
import { DateField } from '@/components/form/date-field';
import { PrimaryButton } from '@/components/primary-button';
import { ConflictBanner } from '@/components/conflict-banner';
import { Card } from '@/components/card';
import { VerifiedCountBadge } from '@/components/verified-count-badge';
import { useDiagnoses } from '@/features/diagnoses/useDiagnoses';
import { useUpdateDiagnosis } from '@/features/diagnoses/useUpdateDiagnosis';
import { useDeleteDiagnosis } from '@/features/diagnoses/useDeleteDiagnosis';
import { useAttestationsForDiagnosis } from '@/features/professional-attestations/useAttestations';
import { diagnosisSchema, type DiagnosisFormValues } from '@/lib/validation/diagnosis-schema';
import { DIAGNOSIS_SEVERITY_OPTIONS } from '@/constants/diagnosis-severity';
import { zodResolver } from '@/lib/zod-resolver';

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

  const form = useForm<DiagnosisFormValues>({
    resolver: zodResolver(diagnosisSchema),
    defaultValues: { condition: '', date_of_diagnosis: '', severity: 'chronic' },
  });

  const { isDirty } = useFormState({ control: form.control });

  const verifiedCount = attestations.filter((a) => a.envelope_type === 'diagnosis_verification').length;

  useEffect(() => {
    if (existing) {
      form.reset({ condition: existing.condition, date_of_diagnosis: existing.date_of_diagnosis ?? '', severity: existing.severity });
    }
  // react-doctor-disable-next-line react-doctor/exhaustive-deps
  }, [existing?.local_uuid, form.reset]);

  if (!existing) {
    return (
      <ThemedView className="flex-1 items-center justify-center px-6">
        <ThemedText>This diagnosis is no longer available.</ThemedText>
      </ThemedView>
    );
  }

  const onSave = async (data: DiagnosisFormValues) => {
    await updateDiagnosis({ localUuid: existing.local_uuid, payload: data });
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
        <ThemedText type="small" color="mutedForeground" className="mb-2">Diagnosed by {existing.diagnosed_by_name}</ThemedText>
      ) : null}

      <Controller control={form.control} name="condition" render={({ field, fieldState }) => (
        <TextField label="Condition" value={field.value} onChangeText={field.onChange} editable={isVerifiedProfessional} error={fieldState.error?.message} />
      )} />
      <Controller control={form.control} name="date_of_diagnosis" render={({ field }) => (
        <DateField label="Date of diagnosis" value={field.value ?? ''} onChange={field.onChange} maximumDate={new Date()} disabled={!isVerifiedProfessional} />
      )} />
      <Controller control={form.control} name="severity" render={({ field }) => (
        <SelectField placeholder="Severity" options={DIAGNOSIS_SEVERITY_OPTIONS} value={field.value} onChange={field.onChange} disabled={!isVerifiedProfessional} getLabel={(v) => v.charAt(0).toUpperCase() + v.slice(1)} />
      )} />

      <Card className="mb-6 flex-row items-center justify-between">
        <ThemedText type="smallBold" color="mutedForeground">Verified by professionals</ThemedText>
        <VerifiedCountBadge count={verifiedCount} />
      </Card>

      {attestations.length > 0 ? (
        <Card className="mb-6 gap-3">
          <ThemedText type="smallBold" color="mutedForeground">Verification history</ThemedText>
          {(() => {
            const attestationMap = new Map<number, { name: string; verified_at: string; note?: string }>();
            attestations.forEach((a) => {
              if (a.payload.type === 'diagnosis_verification') {
                attestationMap.set(a.payload.verified_by.user_id, { name: a.payload.verified_by.name, verified_at: a.payload.verified_at, note: a.payload.note });
              }
            });
            const recordEntries = (existing.verified_by ?? []).filter((v) => !attestationMap.has(v.user_id));
            const merged = [...attestationMap.entries(), ...recordEntries.map((v) => [v.user_id, { name: v.name, verified_at: v.verified_at, note: undefined }] as const)];
            return merged.map(([userId, info]) => (
              <View key={userId}>
                <ThemedText type="small">{info.name} · {new Date(info.verified_at).toLocaleDateString()}</ThemedText>
                {info.note ? <ThemedText type="small" color="mutedForeground">{info.note}</ThemedText> : null}
              </View>
            ));
          })()}
        </Card>
      ) : null}

      {attestations.length === 0 && existing.verified_by && existing.verified_by.length > 0 ? (
        <Card className="mb-6 gap-3">
          <ThemedText type="smallBold" color="mutedForeground">Verified by professionals</ThemedText>
          {existing.verified_by.map((v) => (
            <View key={v.user_id}>
              <ThemedText type="small">{v.name} · {new Date(v.verified_at).toLocaleDateString()}</ThemedText>
            </View>
          ))}
        </Card>
      ) : null}

      {isVerifiedProfessional ? (
        <>
          <PrimaryButton label="Save" loading={isSaving} onPress={() => void form.handleSubmit(onSave)()} disabled={!isDirty || isDeleting || isSaving} className="mb-2" />
          <PrimaryButton label="Delete diagnosis" variant="danger" loading={isDeleting} onPress={onDelete} disabled={isSaving} />
        </>
      ) : null}
    </AppLayout>
  );
}
