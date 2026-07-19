import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AppLayout } from '@/components/layouts/app-layout';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { useProfessionalApplication } from '@/features/professional-application/useProfessionalApplication';
import { useTheme } from '@/hooks/use-theme';
import type { ProfessionalApplicationStatus } from '@/api/types';

const STATUS_LABEL: Record<ProfessionalApplicationStatus, string> = {
  processing: 'Processing',
  pending_review: 'Pending review',
  approved: 'Approved',
  auto_rejected: 'Rejected',
  denied: 'Rejected',
};

const STATUS_ICON: Record<ProfessionalApplicationStatus, keyof typeof Ionicons.glyphMap> = {
  processing: 'hourglass',
  pending_review: 'time',
  approved: 'checkmark-circle',
  auto_rejected: 'close-circle',
  denied: 'close-circle',
};

function statusColor(theme: ReturnType<typeof useTheme>, status: ProfessionalApplicationStatus) {
  if (status === 'approved') return theme.success;
  if (status === 'auto_rejected' || status === 'denied') return theme.destructive;
  return theme.warning;
}

export default function ProfessionalApplicationStatusScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const applicationId = Number(id);
  const { data: application, isLoading } = useProfessionalApplication(applicationId);

  if (isLoading || !application) {
    return (
      <AppLayout>
        <ThemedText color="mutedForeground">Loading…</ThemedText>
      </AppLayout>
    );
  }

  const color = statusColor(theme, application.status);

  return (
    <AppLayout>
      <View className="items-center gap-3 py-8">
        <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: color + '15' }}>
          <Ionicons name={STATUS_ICON[application.status]} size={32} color={color} />
        </View>
        <ThemedText className="text-xl font-semibold">{STATUS_LABEL[application.status]}</ThemedText>
        {application.status === 'processing' ? (
          <ThemedText color="mutedForeground" className="text-center">
            We're verifying your ID and identity. This usually takes a minute.
          </ThemedText>
        ) : null}
        {application.status === 'pending_review' ? (
          <ThemedText color="mutedForeground" className="text-center">
            Your application passed automatic checks and is now waiting for admin review.
          </ThemedText>
        ) : null}
        {application.rejection_reason ? (
          <Card className="mt-2 w-full">
            <ThemedText type="small" color="destructive">
              {application.rejection_reason}
            </ThemedText>
          </Card>
        ) : null}
      </View>

      {(application.profession || application.license_number) && (
        <Card className="gap-2">
          <ThemedText type="overline">Extracted from your ID</ThemedText>
          {application.profession ? (
            <View className="flex-row justify-between">
              <ThemedText type="small" color="mutedForeground">Profession</ThemedText>
              <ThemedText type="small">{application.profession}</ThemedText>
            </View>
          ) : null}
          {application.license_number ? (
            <View className="flex-row justify-between">
              <ThemedText type="small" color="mutedForeground">License number</ThemedText>
              <ThemedText type="small">{application.license_number}</ThemedText>
            </View>
          ) : null}
          {application.license_expiry ? (
            <View className="flex-row justify-between">
              <ThemedText type="small" color="mutedForeground">Expiry</ThemedText>
              <ThemedText type="small">{application.license_expiry}</ThemedText>
            </View>
          ) : null}
        </Card>
      )}
    </AppLayout>
  );
}
