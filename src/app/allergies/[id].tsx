import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { AppLayout } from '@/components/layouts/app-layout';
import { TextField } from '@/components/form/text-field';
import { PickerField } from '@/components/form/picker-field';
import { PrimaryButton } from '@/components/primary-button';
import { ConflictBanner } from '@/components/conflict-banner';
import { Card } from '@/components/card';
import { useAllergies } from '@/features/allergies/useAllergies';
import { useUpdateAllergy } from '@/features/allergies/useUpdateAllergy';
import { useDeleteAllergy } from '@/features/allergies/useDeleteAllergy';
import { useAttestationsForAllergy } from '@/features/professional-attestations/useAttestations';
import type { Allergy } from '@/api/types';

const SEVERITIES: Allergy['severity'][] = ['mild', 'moderate', 'severe', 'life-threatening'];

export default function EditAllergyScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: allergies = [] } = useAllergies();
  const { mutateAsync: updateAllergy, isPending: isSaving } = useUpdateAllergy();
  const { mutateAsync: deleteAllergy, isPending: isDeleting } = useDeleteAllergy();
  const { data: attestations = [] } = useAttestationsForAllergy(id);

  const existing = allergies.find((a) => a.local_uuid === id);

  const [allergen, setAllergen] = useState('');
  const [reaction, setReaction] = useState('');
  const [severity, setSeverity] = useState<Allergy['severity']>('mild');

  useEffect(() => {
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time seed of edit form state once the queried record loads
      setAllergen(existing.allergen);
      setReaction(existing.reaction ?? '');
      setSeverity(existing.severity);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-seed only when switching records, not on every background refetch
  }, [existing?.local_uuid]);

  if (!existing) {
    return (
      <ThemedView className="flex-1 items-center justify-center px-6">
        <ThemedText>This allergy is no longer available.</ThemedText>
      </ThemedView>
    );
  }

  const onSave = async () => {
    await updateAllergy({ localUuid: existing.local_uuid, payload: { allergen, reaction: reaction || undefined, severity } });
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

      <TextField label="Allergen" value={allergen} onChangeText={setAllergen} />
      <TextField label="Reaction" value={reaction} onChangeText={setReaction} />
      <PickerField label="Severity" options={SEVERITIES} value={severity} onChange={setSeverity} />

      {attestations.length > 0 ? (
        <Card className="mb-6 gap-3">
          <ThemedText type="smallBold" color="mutedForeground">
            Verified by professionals
          </ThemedText>
          {attestations.map((attestation) =>
            attestation.payload.type === 'allergy_verification' ? (
              <View key={attestation.local_id}>
                <ThemedText type="small">
                  {attestation.payload.verified_by.name} · {new Date(attestation.payload.verified_at).toLocaleDateString()}
                </ThemedText>
                {attestation.payload.note ? (
                  <ThemedText type="small" color="mutedForeground">
                    {attestation.payload.note}
                  </ThemedText>
                ) : null}
              </View>
            ) : null,
          )}
        </Card>
      ) : null}

      <PrimaryButton label="Save" loading={isSaving} onPress={onSave} disabled={isDeleting} className="mb-2" />
      <PrimaryButton label="Delete allergy" variant="danger" loading={isDeleting} onPress={onDelete} disabled={isSaving} />
    </AppLayout>
  );
}
