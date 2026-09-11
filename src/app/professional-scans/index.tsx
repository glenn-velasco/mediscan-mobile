import { memo, useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import { EmptyState } from '@/components/empty-state';
import { AppLayout } from '@/components/layouts/app-layout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useScannedPatients } from '@/features/professional-scans/useScannedPatients';
import { useTheme } from '@/hooks/use-theme';
import { formatIsoDate } from '@/lib/format-date';
import { toScanSummary } from '@/db/repositories/scanned-patients.repo';
import type { ScannedPatientRow } from '@/db/schema';

function PatientAvatar({ uri, name }: { uri: string | null; name: string }) {
  const theme = useTheme();
  const [imageError, setImageError] = useState(false);

  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

  if (uri && !imageError) {
    return (
      <Image
        source={{ uri }}
        style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.accent }}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <View
      style={{
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: theme.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ThemedText style={{ color: theme.accentForeground, fontWeight: '600' }}>
        {initials}
      </ThemedText>
    </View>
  );
}

type ScanItemProps = {
  item: ScannedPatientRow;
  onPress: () => void;
};

const ScanPatientCard = memo(function ScanPatientCard({ item, onPress }: ScanItemProps) {
  const summary = toScanSummary(item);

  return (
    <Pressable onPress={onPress} className="active:bg-accent">
      <View className="flex-row items-center gap-3 py-3.5">
        <PatientAvatar uri={summary.avatar} name={summary.fullname} />
        <View className="flex-1">
          <ThemedText type="body" className="font-semibold">
            {summary.fullname}
          </ThemedText>
          <View className="flex-row flex-wrap gap-x-3 gap-y-0.5">
            {summary.age != null && (
              <ThemedText type="small" color="mutedForeground">
                {summary.age} yrs
              </ThemedText>
            )}
            {summary.gender && (
              <ThemedText type="small" color="mutedForeground">
                {summary.gender}
              </ThemedText>
            )}
            {summary.dob && (
              <ThemedText type="small" color="mutedForeground">
                {formatIsoDate(summary.dob)}
              </ThemedText>
            )}
          </View>
          {summary.notes ? (
            <ThemedText type="small" color="mutedForeground" numberOfLines={1} className="mt-0.5">
              {summary.notes}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

export default function ScannedPatientsScreen() {
  const { data: patients = [], isLoading, refetch, isRefetching } = useScannedPatients();
  const router = useRouter();
  const theme = useTheme();

  const handlePress = useCallback(
    (patientId: string | number) => {
      router.push({ pathname: '/professional-scans/[patientId]', params: { patientId: String(patientId) } });
    },
    [router],
  );

  const renderItem = useCallback(
    ({ item }: { item: ScannedPatientRow }) => (
      <ScanPatientCard item={item} onPress={() => handlePress(item.patient_server_id)} />
    ),
    [handlePress],
  );

  const keyExtractor = useCallback((item: ScannedPatientRow) => String(item.patient_server_id), []);

  if (isLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <AppLayout scrollable={false}>
      {patients.length === 0 ? (
        <ThemedView className="flex-1 items-center justify-center">
          <EmptyState
            title="No scanned patients"
            body="Patients you scan will appear here for quick access."
            icon="scan-outline"
          />
        </ThemedView>
      ) : (
        <FlatList
          data={patients}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View className="h-px bg-border" />}
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
