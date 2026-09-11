import { useEffect } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useForm, Controller, useFormState } from 'react-hook-form';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { AppLayout } from '@/components/layouts/app-layout';
import { TextField } from '@/components/form/text-field';
import { SelectField } from '@/components/form/select-field';
import { PrimaryButton } from '@/components/primary-button';
import { ConflictBanner } from '@/components/conflict-banner';
import { Card } from '@/components/card';
import { useAllergies } from '@/features/allergies/useAllergies';
import { useUpdateAllergy } from '@/features/allergies/useUpdateAllergy';
import { useDeleteAllergy } from '@/features/allergies/useDeleteAllergy';
import { useAttestationsForAllergy } from '@/features/professional-attestations/useAttestations';
import { allergySchema, type AllergyFormValues } from '@/lib/validation/allergy-schema';
import { ALLERGY_SEVERITY_OPTIONS } from '@/constants/allergy-severity';
import { zodResolver } from '@/lib/zod-resolver';

export default function EditAllergyScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: allergies = [] } = useAllergies();
  const { mutateAsync: updateAllergy, isPending: isSaving } = useUpdateAllergy();
  const { mutateAsync: deleteAllergy, isPending: isDeleting } = useDeleteAllergy();
  const { data: attestations = [] } = useAttestationsForAllergy(id);

  const existing = allergies.find((a) => a.local_uuid === id);

  const form = useForm<AllergyFormValues>({
    resolver: zodResolver(allergySchema),
    defaultValues: { allergen: '', reaction: '', severity: 'mild' },
  });

  const { isDirty } = useFormState({ control: form.control });

  useEffect(() => {
    if (existing) {
      form.reset({ allergen: existing.allergen, reaction: existing.reaction ?? '', severity: existing.severity });
    }
  // react-doctor-disable-next-line react-doctor/exhaustive-deps
  }, [existing?.local_uuid, form.reset]);

  if (!existing) {
    return (
      <ThemedView className="flex-1 items-center justify-center px-6">
        <ThemedText>This allergy is no longer available.</ThemedText>
      </ThemedView>
    );
  }

  const onSave = async (data: AllergyFormValues) => {
    await updateAllergy({ localUuid: existing.local_uuid, payload: data });
    router.back();
  };

  const onDelete = async () => {
    await deleteAllergy(existing.local_uuid);
    router.back();
  };

  return (
    <AppLayout avoidKeyboard>
      {existing.sync_status === 'conflict' || existing.sync_status === 'failed' ? (
        <ConflictBanner message="This couldn't be saved. Check sync status for details." className="mb-4" />
      ) : null}

      <Controller control={form.control} name="allergen" render={({ field, fieldState }) => (
        <TextField label="Allergen" value={field.value} onChangeText={field.onChange} error={fieldState.error?.message} />
      )} />
      <Controller control={form.control} name="reaction" render={({ field, fieldState }) => (
        <TextField label="Reaction" value={field.value ?? ''} onChangeText={field.onChange} error={fieldState.error?.message} />
      )} />
      <Controller control={form.control} name="severity" render={({ field }) => (
        <SelectField placeholder="Severity" options={ALLERGY_SEVERITY_OPTIONS} value={field.value} onChange={field.onChange} getLabel={(v) => v.charAt(0).toUpperCase() + v.slice(1)} />
      )} />

      {(attestations.length > 0 || (existing.verified_by && existing.verified_by.length > 0)) ? (
        <Card className="mb-6 gap-3">
          <ThemedText type="smallBold" color="mutedForeground">Verified by professionals</ThemedText>
          {(() => {
            const attestationMap = new Map<string | number, { name: string; verified_at: string; note?: string }>();
            attestations.forEach((a) => {
              if (a.payload.type === 'allergy_verification') {
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

      <PrimaryButton label="Save" loading={isSaving} onPress={() => void form.handleSubmit(onSave)()} disabled={!isDirty || isDeleting || isSaving} className="mb-2" />
      <PrimaryButton label="Delete allergy" variant="danger" loading={isDeleting} onPress={onDelete} disabled={isSaving} />
    </AppLayout>
  );
}
