import { FlatList, Pressable, View, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { AppLayout } from '@/components/layouts/app-layout';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ConflictBanner } from '@/components/conflict-banner';
import { VerifiedCountBadge } from '@/components/verified-count-badge';
import { useConditions } from '@/features/conditions/useConditions';
import { useAttestations } from '@/features/professional-attestations/useAttestations';
import { useTheme } from '@/hooks/use-theme';
import type { ConditionRow } from '@/db/schema';

const SYNC_LABEL: Partial<Record<string, string>> = {
  pending: 'Not yet synced',
  syncing: 'Syncing…',
};

function ConditionRowCard({ item, verifiedCount }: { item: ConditionRow; verifiedCount: number }) {
  const href = { pathname: '/conditions/[id]' as const, params: { id: item.local_uuid } };
  const syncLabel = SYNC_LABEL[item.sync_status];

  return (
    <Link href={href} asChild>
      <Pressable className="active:bg-accent">
        <View className="flex-row items-center justify-between py-3.5">
          <View className="flex-1 mr-3">
            <ThemedText>{item.description}</ThemedText>
            <ThemedText type="small" color="mutedForeground">
              {syncLabel ?? ''}
            </ThemedText>
          </View>
          <VerifiedCountBadge count={verifiedCount} />
        </View>
        {item.sync_status === 'conflict' || item.sync_status === 'failed' ? (
          <ConflictBanner message="This couldn't be saved. Check sync status for details." className="mb-2" />
        ) : null}
      </Pressable>
    </Link>
  );
}

export default function ConditionsScreen() {
  const theme = useTheme();
  const { data: conditions = [], isLoading } = useConditions();
  const { data: attestations = [] } = useAttestations();

  const verifiedCountByUuid = () => {
    const map = new Map<string, number>();
    for (const att of attestations) {
      if (att.envelope_type === 'condition_verification' && att.matched_condition_local_uuid) {
        map.set(att.matched_condition_local_uuid, (map.get(att.matched_condition_local_uuid) ?? 0) + 1);
      }
    }
    return map;
  };

  if (isLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <AppLayout scrollable={false}>
      {conditions.length === 0 ? (
        <ThemedView className="flex-1 items-center justify-center">
          <EmptyState title="No conditions yet" body="Add any known health conditions so they're on hand in an emergency." />
        </ThemedView>
      ) : (
        <FlatList
          data={conditions}
          keyExtractor={(item) => item.local_uuid}
          ItemSeparatorComponent={() => <View className="h-px bg-border" />}
          renderItem={({ item }) => (
            <ConditionRowCard
              item={item}
              verifiedCount={verifiedCountByUuid().get(item.local_uuid) ?? 0}
            />
          )}
        />
      )}
    </AppLayout>
  );
}
