import { memo, useMemo } from 'react';
import { FlatList, Pressable, View, ActivityIndicator } from 'react-native';
import { Link } from 'expo-router';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { AppLayout } from '@/components/layouts/app-layout';
import { Card } from '@/components/card';
import { DiagnosisSeverityBadge } from '@/components/diagnosis-severity-badge';
import { VerifiedCountBadge } from '@/components/verified-count-badge';
import { EmptyState } from '@/components/empty-state';
import { ConflictBanner } from '@/components/conflict-banner';
import { useDiagnoses } from '@/features/diagnoses/useDiagnoses';
import { useAttestations, useUnconfirmedDiagnosisAttestations, useConfirmDiagnosisAttestationMatch } from '@/features/professional-attestations/useAttestations';
import { useTheme } from '@/hooks/use-theme';
import { formatIsoDate } from '@/lib/format-date';
import type { DiagnosisRow } from '@/db/schema';

const UnconfirmedDiagnosisAttestations = memo(function UnconfirmedDiagnosisAttestations({ diagnoses }: { diagnoses: DiagnosisRow[] }) {
  const { data: unconfirmed } = useUnconfirmedDiagnosisAttestations();
  const { mutate: confirmMatch, isPending } = useConfirmDiagnosisAttestationMatch();
  const theme = useTheme();

  if (unconfirmed.length === 0 || diagnoses.length === 0) return null;

  return (
    <View className="mb-2 gap-2">
      {unconfirmed.map((attestation) => {
        if (attestation.payload.type !== 'diagnosis_verification') return null;
        const { condition, severity, verified_by } = attestation.payload;

        return (
          <Card key={attestation.local_id} className="gap-2" style={{ borderColor: theme.warning + '4d', backgroundColor: theme.warning + '1a', borderWidth: 1 }}>
            <ThemedText type="small" className="font-semibold">
              {verified_by.name} verified &quot;{condition}&quot; ({severity}) — which diagnosis is this?
            </ThemedText>
            <View className="flex-row flex-wrap gap-2">
              {diagnoses.map((diagnosis) => (
                <Pressable
                  key={diagnosis.local_uuid}
                  disabled={isPending}
                  onPress={() => confirmMatch({ localId: attestation.local_id, diagnosisLocalUuid: diagnosis.local_uuid })}
                  className="rounded-full px-3 py-1.5"
                  style={{ borderWidth: 1, borderColor: theme.input, backgroundColor: theme.background }}
                >
                  <ThemedText type="small">{diagnosis.condition}</ThemedText>
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

const DiagnosisRowCard = memo(function DiagnosisRowCard({ item, verifiedCount }: { item: DiagnosisRow; verifiedCount: number }) {
  const href = useMemo(
    () => ({ pathname: '/diagnoses/[id]' as const, params: { id: item.local_uuid } }),
    [item.local_uuid],
  );
  const syncLabel = SYNC_LABEL[item.sync_status];

  return (
    <Link href={href} asChild>
      <Pressable className="active:bg-accent">
        <View className="flex-row items-center justify-between py-3.5">
          <View className="flex-1">
            <ThemedText>{item.condition}</ThemedText>
            <ThemedText type="small" color="mutedForeground">
              {syncLabel ?? (item.date_of_diagnosis ? `Diagnosed ${formatIsoDate(item.date_of_diagnosis)}` : '')}
            </ThemedText>
          </View>
          <View className="flex-row items-center gap-2">
            <VerifiedCountBadge count={verifiedCount} />
            <DiagnosisSeverityBadge severity={item.severity} />
          </View>
        </View>
        {item.sync_status === 'conflict' || item.sync_status === 'failed' ? (
          <ConflictBanner message="This couldn't be saved. Check sync status for details." className="mb-2" />
        ) : null}
      </Pressable>
    </Link>
  );
});

export default function DiagnosesScreen() {
  const { data: diagnoses = [], isLoading } = useDiagnoses();
  const { data: attestations = [] } = useAttestations();

  const verifiedCountByUuid = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of attestations) {
      if (a.envelope_type === 'diagnosis_verification' && a.matched_diagnosis_local_uuid) {
        map.set(a.matched_diagnosis_local_uuid, (map.get(a.matched_diagnosis_local_uuid) ?? 0) + 1);
      }
    }
    return map;
  }, [attestations]);

  if (isLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  return (
    <AppLayout scrollable={false}>
      {diagnoses.length === 0 ? (
        <ThemedView className="flex-1 items-center justify-center">
          <EmptyState title="No diagnoses yet" body="Add any known diagnoses so they’re on hand in an emergency." />
        </ThemedView>
      ) : (
        <FlatList
          data={diagnoses}
          keyExtractor={(item) => item.local_uuid}
          ListHeaderComponent={<UnconfirmedDiagnosisAttestations diagnoses={diagnoses} />}
          ItemSeparatorComponent={() => <View className="h-px bg-border" />}
          renderItem={({ item }) => <DiagnosisRowCard item={item} verifiedCount={verifiedCountByUuid.get(item.local_uuid) ?? 0} />}
        />
      )}
    </AppLayout>
  );
}
