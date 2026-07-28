import { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller, useFormState } from 'react-hook-form';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { AppLayout } from '@/components/layouts/app-layout';
import { TextField } from '@/components/form/text-field';
import { PrimaryButton } from '@/components/primary-button';
import { ConflictBanner } from '@/components/conflict-banner';
import { Card } from '@/components/card';
import { useMedications } from '@/features/medications/useMedications';
import { useUpdateMedication } from '@/features/medications/useUpdateMedication';
import { useDeleteMedication } from '@/features/medications/useDeleteMedication';
import { useAttestationsForMedication } from '@/features/professional-attestations/useAttestations';
import { medicationSchema, type MedicationFormValues } from '@/lib/validation/medication-schema';
import { zodResolver } from '@/lib/zod-resolver';

export default function EditMedicationScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: medications = [] } = useMedications();
  const { mutateAsync: updateMedication, isPending: isSaving } = useUpdateMedication();
  const { mutateAsync: deleteMedication, isPending: isDeleting } = useDeleteMedication();
  const { data: attestations = [] } = useAttestationsForMedication(id);

  const existing = medications.find((m) => m.local_uuid === id);

  const form = useForm<MedicationFormValues>({
    resolver: zodResolver(medicationSchema),
    defaultValues: { name: '', dosage: '', frequency: '', notes: '' },
  });

  const { isDirty } = useFormState({ control: form.control });

  useEffect(() => {
    if (existing) {
      form.reset({ name: existing.name, dosage: existing.dosage, frequency: existing.frequency, notes: existing.notes ?? '' });
    }
  // react-doctor-disable-next-line react-doctor/exhaustive-deps
  }, [existing?.local_uuid, form.reset]);

  if (!existing) {
    return (
      <ThemedView className="flex-1 items-center justify-center px-6">
        <ThemedText>This medication is no longer available.</ThemedText>
      </ThemedView>
    );
  }

  const onSave = async (data: MedicationFormValues) => {
    await updateMedication({ localUuid: existing.local_uuid, payload: data });
    router.back();
  };

  const onDelete = async () => {
    await deleteMedication(existing.local_uuid);
    router.back();
  };

  return (
    <AppLayout avoidKeyboard>
      {existing.sync_status === 'conflict' || existing.sync_status === 'failed' ? (
        <ConflictBanner message="This couldn't be saved. Check sync status for details." className="mb-4" />
      ) : null}

      <Controller control={form.control} name="name" render={({ field, fieldState }) => (
        <TextField label="Name" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
      )} />
      <Controller control={form.control} name="dosage" render={({ field, fieldState }) => (
        <TextField label="Dosage" value={field.value ?? ''} onChangeText={field.onChange} error={fieldState.error?.message} />
      )} />
      <Controller control={form.control} name="frequency" render={({ field, fieldState }) => (
        <TextField label="Frequency" value={field.value ?? ''} onChangeText={field.onChange} error={fieldState.error?.message} />
      )} />
      <Controller control={form.control} name="notes" render={({ field, fieldState }) => (
        <TextField label="Notes" value={field.value ?? ''} onChangeText={field.onChange} error={fieldState.error?.message} />
      )} />

      {(attestations.length > 0 || (existing.verified_by && existing.verified_by.length > 0)) ? (
        <Card className="mb-6 gap-3">
          <ThemedText type="smallBold" color="mutedForeground">
            Verified by professionals
          </ThemedText>
          {(() => {
            const attestationMap = new Map<number, { name: string; verified_at: string; note?: string }>();
            attestations.forEach((a) => {
              if (a.payload.type === 'medication_verification') {
                attestationMap.set(a.payload.verified_by.user_id, {
                  name: a.payload.verified_by.name,
                  verified_at: a.payload.verified_at,
                  note: a.payload.note,
                });
              }
            });
            const recordEntries = (existing.verified_by ?? []).filter((v) => !attestationMap.has(v.user_id));
            const merged = [...attestationMap.entries(), ...recordEntries.map((v) => [v.user_id, { name: v.name, verified_at: v.verified_at, note: undefined }] as const)];
            return merged.map(([userId, info]) => (
              <View key={userId}>
                <ThemedText type="small">
                  {info.name} · {new Date(info.verified_at).toLocaleDateString()}
                </ThemedText>
                {info.note ? (
                  <ThemedText type="small" color="mutedForeground">
                    {info.note}
                  </ThemedText>
                ) : null}
              </View>
            ));
          })()}
        </Card>
      ) : null}

      <PrimaryButton label="Save" loading={isSaving} onPress={() => void form.handleSubmit(onSave)()} disabled={!isDirty || isDeleting || isSaving} className="mb-2" />
      <PrimaryButton label="Delete medication" variant="danger" loading={isDeleting} onPress={onDelete} disabled={isSaving} />
    </AppLayout>
  );
}
