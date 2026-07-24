import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

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

export default function EditMedicationScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: medications = [] } = useMedications();
  const { mutateAsync: updateMedication, isPending: isSaving } = useUpdateMedication();
  const { mutateAsync: deleteMedication, isPending: isDeleting } = useDeleteMedication();
  const { data: attestations = [] } = useAttestationsForMedication(id);

  const existing = medications.find((m) => m.local_uuid === id);

  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (existing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time seed of edit form state once the queried record loads
      setName(existing.name);
      setDosage(existing.dosage);
      setFrequency(existing.frequency);
      setNotes(existing.notes ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-seed only when switching records, not on every background refetch
  }, [existing?.local_uuid]);

  if (!existing) {
    return (
      <ThemedView className="flex-1 items-center justify-center px-6">
        <ThemedText>This medication is no longer available.</ThemedText>
      </ThemedView>
    );
  }

  const onSave = async () => {
    await updateMedication({ localUuid: existing.local_uuid, payload: { name, dosage, frequency, notes: notes || undefined } });
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

      <TextField label="Name" value={name} onChangeText={setName} />
      <TextField label="Dosage" value={dosage} onChangeText={setDosage} />
      <TextField label="Frequency" value={frequency} onChangeText={setFrequency} />
      <TextField label="Notes" value={notes} onChangeText={setNotes} />

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

      <PrimaryButton label="Save" loading={isSaving} onPress={onSave} disabled={isDeleting} className="mb-2" />
      <PrimaryButton label="Delete medication" variant="danger" loading={isDeleting} onPress={onDelete} disabled={isSaving} />
    </AppLayout>
  );
}
