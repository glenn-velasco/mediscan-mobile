import { memo, useCallback, useMemo } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { AppLayout } from '@/components/layouts/app-layout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useMyScanActivity } from '@/features/my-scan-activity/useMyScanActivity';
import { useTheme } from '@/hooks/use-theme';
import { toScanActivity } from '@/db/repositories/my-scan-activity.repo';
import type { MyScanActivityRow } from '@/db/schema';

function formatRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(isoDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

type ScanEventItemProps = {
  item: MyScanActivityRow;
};

const ScanEventItem = memo(function ScanEventItem({ item }: ScanEventItemProps) {
  const theme = useTheme();
  const activity = useMemo(() => toScanActivity(item), [item]);

  const initials = useMemo(
    () =>
      activity.scanner_fullname
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || '?',
    [activity.scanner_fullname],
  );

  return (
    <View className="flex-row items-center gap-3 py-3.5">
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: theme.accent,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ThemedText style={{ color: theme.accentForeground, fontWeight: '600', fontSize: 15 }}>
          {initials}
        </ThemedText>
      </View>
      <View className="flex-1">
        <ThemedText type="body" className="font-semibold">
          {activity.scanner_fullname}
        </ThemedText>
        <View className="flex-row items-center gap-1.5 mt-0.5">
          <ThemedText type="small" color="mutedForeground">
            Verified Professional
          </ThemedText>
          <ThemedText type="small" color="mutedForeground">
            {' · '}
          </ThemedText>
          <ThemedText type="small" color="mutedForeground">
            {formatRelativeTime(activity.scanned_at)}
          </ThemedText>
        </View>
      </View>
    </View>
  );
});

export default function WhoScannedMeScreen() {
  const { data: events = [], isLoading, refetch, isRefetching } = useMyScanActivity();
  const theme = useTheme();

  const renderItem = useCallback(
    ({ item }: { item: MyScanActivityRow }) => <ScanEventItem item={item} />,
    [],
  );

  const keyExtractor = useCallback((item: MyScanActivityRow) => String(item.id), []);

  const ItemSeparator = useCallback(() => <View className="h-px bg-border" />, []);

  if (isLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <AppLayout scrollable={false}>
      {events.length === 0 ? (
        <ThemedView className="flex-1 items-center justify-center">
          <EmptyState
            title="No scan activity"
            body="When a professional scans your QR code, it will appear here."
            icon="people-outline"
          />
        </ThemedView>
      ) : (
        <FlatList
          data={events}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={ItemSeparator}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          refreshing={isRefetching}
          onRefresh={refetch}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
        />
      )}
    </AppLayout>
  );
}
