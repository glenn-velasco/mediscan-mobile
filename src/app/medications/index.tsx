import { memo, useMemo } from 'react';
import { FlatList, Pressable, View, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { AppLayout } from '@/components/layouts/app-layout';
import { EmptyState } from '@/components/empty-state';
import { ConflictBanner } from '@/components/conflict-banner';
import { useMedications } from '@/features/medications/useMedications';
import { useUnconfirmedMedicationAttestations, useConfirmMedicationAttestationMatch } from '@/features/professional-attestations/useAttestations';
import { useTheme } from '@/hooks/use-theme';
import { Card } from '@/components/card';
import type { MedicationRow } from '@/db/schema';

const UnconfirmedMedicationAttestations = memo(function UnconfirmedMedicationAttestations({ medications }: { medications: MedicationRow[] }) {
  const { data: unconfirmed } = useUnconfirmedMedicationAttestations();
  const { mutate: confirmMatch, isPending } = useConfirmMedicationAttestationMatch();
  const theme = useTheme();

  if (unconfirmed.length === 0 || medications.length === 0) return null;

  return (
    <View className="mb-2 gap-2">
      {unconfirmed.map((attestation) => {
        if (attestation.payload.type !== 'medication_verification') return null;
        const { name, dosage, verified_by } = attestation.payload;

        return (
          <Card key={attestation.local_id} className="gap-2" style={{ borderColor: theme.warning + '4d', backgroundColor: theme.warning + '1a', borderWidth: 1 }}>
            <ThemedText type="small" className="font-semibold">
              {verified_by.name} verified &quot;{name}&quot; ({dosage}) — which medication is this?
            </ThemedText>
            <View className="flex-row flex-wrap gap-2">
              {medications.map((medication) => (
                <Pressable
                  key={medication.local_uuid}
                  disabled={isPending}
                  onPress={() => confirmMatch({ localId: attestation.local_id, medicationLocalUuid: medication.local_uuid })}
                  className="rounded-full px-3 py-1.5"
                  style={{ borderWidth: 1, borderColor: theme.input, backgroundColor: theme.background }}
                >
                  <ThemedText type="small">{medication.name}</ThemedText>
                </Pressable>
              ))}
            </View>
          </Card>
        );
      })}
    </View>
  );
});

const SYNC_LABEL: Partial<Record<string, string>> = {
  pending: 'Not yet synced',
  syncing: 'Syncing…',
};

const MedicationRowCard = memo(function MedicationRowCard({ item }: { item: MedicationRow }) {
  const href = useMemo(
    () => ({ pathname: '/medications/[id]' as const, params: { id: item.local_uuid } }),
    [item.local_uuid],
  );
  const syncLabel = SYNC_LABEL[item.sync_status];

  return (
    <Link href={href} asChild>
      <Pressable className="active:bg-accent">
        <View className="flex-row items-center justify-between py-3.5">
          <View className="flex-1">
            <ThemedText>{item.name}</ThemedText>
            <ThemedText type="small" color="mutedForeground">
              {syncLabel ?? [item.dosage, item.frequency].filter(Boolean).join(' · ')}
            </ThemedText>
          </View>
        </View>
        {item.sync_status === 'conflict' || item.sync_status === 'failed' ? (
          <ConflictBanner message="This couldn't be saved. Check sync status for details." className="mb-2" />
        ) : null}
      </Pressable>
    </Link>
  );
});

export default function MedicationsScreen() {
  const { data: medications = [], isLoading } = useMedications();
  const theme = useTheme();

  if (isLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <AppLayout scrollable={false}>
      {medications.length === 0 ? (
        <ThemedView className="flex-1 items-center justify-center">
          <EmptyState title="No medications yet" body="Add any current medications so they’re on hand in an emergency." />
        </ThemedView>
      ) : (
        <FlatList
          data={medications}
          keyExtractor={(item) => item.local_uuid}
          ListHeaderComponent={<UnconfirmedMedicationAttestations medications={medications} />}
          ItemSeparatorComponent={() => <View className="h-px bg-border" />}
          renderItem={({ item }) => <MedicationRowCard item={item} />}
        />
      )}
    </AppLayout>
  );
}
