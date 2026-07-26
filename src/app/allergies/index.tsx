import { memo, useMemo } from 'react';
import { FlatList, Pressable, View, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { AppLayout } from '@/components/layouts/app-layout';
import { Card } from '@/components/card';
import { SeverityBadge } from '@/components/severity-badge';
import { EmptyState } from '@/components/empty-state';
import { ConflictBanner } from '@/components/conflict-banner';
import { useAllergies } from '@/features/allergies/useAllergies';
import { useUnconfirmedAttestations, useConfirmAttestationMatch } from '@/features/professional-attestations/useAttestations';
import { useTheme } from '@/hooks/use-theme';
import type { AllergyRow } from '@/db/schema';

const UnconfirmedAttestations = memo(function UnconfirmedAttestations({ allergies }: { allergies: AllergyRow[] }) {
  const { data: unconfirmed } = useUnconfirmedAttestations();
  const { mutate: confirmMatch, isPending } = useConfirmAttestationMatch();
  const theme = useTheme();

  if (unconfirmed.length === 0 || allergies.length === 0) return null;

  return (
    <View className="mb-2 gap-2">
      {unconfirmed.map((attestation) => {
        if (attestation.payload.type !== 'allergy_verification') return null;
        const { allergen, severity, verified_by } = attestation.payload;

        return (
          <Card key={attestation.local_id} className="gap-2" style={{ borderColor: theme.warning + '4d', backgroundColor: theme.warning + '1a', borderWidth: 1 }}>
            <ThemedText type="small" className="font-semibold">
              {verified_by.name} verified &quot;{allergen}&quot; ({severity}) — which allergy is this?
            </ThemedText>
            <View className="flex-row flex-wrap gap-2">
              {allergies.map((allergy) => (
                <Pressable
                  key={allergy.local_uuid}
                  disabled={isPending}
                  onPress={() => confirmMatch({ localId: attestation.local_id, allergyLocalUuid: allergy.local_uuid })}
                  className="rounded-full px-3 py-1.5"
                  style={{ borderWidth: 1, borderColor: theme.input, backgroundColor: theme.background }}
                >
                  <ThemedText type="small">{allergy.allergen}</ThemedText>
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

const AllergyRowCard = memo(function AllergyRowCard({ item }: { item: AllergyRow }) {
  const href = useMemo(
    () => ({ pathname: '/allergies/[id]' as const, params: { id: item.local_uuid } }),
    [item.local_uuid],
  );
  const syncLabel = SYNC_LABEL[item.sync_status];

  return (
    <Link href={href} asChild>
      <Pressable className="active:bg-accent">
        <View className="flex-row items-center justify-between py-3.5">
          <View className="flex-1">
            <ThemedText>{item.allergen}</ThemedText>
            <ThemedText type="small" color="mutedForeground">
              {syncLabel ?? item.reaction ?? ''}
            </ThemedText>
          </View>
          <SeverityBadge severity={item.severity} />
        </View>
        {item.sync_status === 'conflict' || item.sync_status === 'failed' ? (
          <ConflictBanner message="This couldn't be saved. Check sync status for details." className="mb-2" />
        ) : null}
      </Pressable>
    </Link>
  );
});

export default function AllergiesScreen() {
  const { data: allergies = [], isLoading } = useAllergies();
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
      {allergies.length === 0 ? (
        <ThemedView className="flex-1 items-center justify-center">
          <EmptyState title="No allergies yet" body="Add any known allergies so they’re on hand in an emergency." />
        </ThemedView>
      ) : (
        <FlatList
          data={allergies}
          keyExtractor={(item) => item.local_uuid}
          ListHeaderComponent={<UnconfirmedAttestations allergies={allergies} />}
          ItemSeparatorComponent={() => <View className="h-px bg-border" />}
          renderItem={({ item }) => <AllergyRowCard item={item} />}
        />
      )}
    </AppLayout>
  );
}
