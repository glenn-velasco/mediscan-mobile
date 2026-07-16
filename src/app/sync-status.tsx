import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { AppLayout } from '@/components/layouts/app-layout';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { usePendingSync, usePullPendingSync } from '@/features/pending-sync/usePendingSync';
import type { PendingSyncEnvelopeRow } from '@/db/schema';

const ENVELOPE_TYPE_LABEL: Record<string, string> = {
  allergy_verification: 'Allergy verification',
  diagnosis_verification: 'Diagnosis verification',
  transfusion_witness: 'Transfusion witness',
  general_note: 'Note',
};

function describeStatus(row: PendingSyncEnvelopeRow): string {
  switch (row.status) {
    case 'received':
      return 'Waiting to process';
    case 'decrypted':
    case 'merged':
      return 'Processing…';
    case 'acked':
      return row.transport === 'ble' ? 'Received via Bluetooth' : 'Received via relay';
    case 'decrypt_failed':
      return row.decrypt_error ? `Couldn't be read (${row.decrypt_error}) — try re-registering your sync key` : "Couldn't be read — try re-registering your sync key";
    case 'expired':
      return 'Expired before it could be delivered';
    case 'discarded':
      return 'Discarded';
    default:
      return row.status;
  }
}

export default function SyncStatusScreen() {
  const theme = useTheme();
  const { data: rows = [], isLoading } = usePendingSync();
  const { mutateAsync: pull, isPending: isPulling } = usePullPendingSync();
  const [refreshing, setRefreshing] = useState(false);

  const onRetryPull = async () => {
    setRefreshing(true);
    try {
      await pull();
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ThemedText>Loading…</ThemedText>
      </ThemedView>
    );
  }

  if (rows.length === 0) {
    return (
      <ThemedView className="flex-1 items-center justify-center gap-4">
        <EmptyState title="All caught up" body="There are no updates waiting to sync." />
        <Pressable onPress={() => void onRetryPull()} disabled={isPulling}>
          <ThemedText type="linkPrimary">{isPulling ? 'Checking…' : 'Check for updates'}</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <AppLayout scrollable={false}>
      <View className="mb-3 flex-row items-center justify-between">
        <ThemedText type="small" color="mutedForeground">
          {rows.length} update{rows.length === 1 ? '' : 's'}
        </ThemedText>
        <Pressable onPress={() => void onRetryPull()} disabled={isPulling} hitSlop={8}>
          <ThemedText type="linkPrimary">{isPulling ? 'Checking…' : 'Retry pull'}</ThemedText>
        </Pressable>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.local_id}
        contentContainerClassName="gap-2"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRetryPull()} tintColor={theme.foreground} colors={[theme.primary]} progressBackgroundColor={theme.background} />}
        renderItem={({ item }) => (
          <Card>
            <ThemedText>{ENVELOPE_TYPE_LABEL[item.envelope_type] ?? item.envelope_type}</ThemedText>
            <ThemedText type="small" className="mt-1" style={{ color: item.status === 'decrypt_failed' ? theme.destructive : theme.mutedForeground }}>
              {describeStatus(item)}
            </ThemedText>
          </Card>
        )}
      />
    </AppLayout>
  );
}
