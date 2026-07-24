import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AppLayout } from '@/components/layouts/app-layout';
import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import {
  useMyProfessionalApplication,
  useProfessionalApplication,
  useProfessionalApplicationBroadcastStatus,
} from '@/features/professional-application/useProfessionalApplication';
import { useTheme } from '@/hooks/use-theme';
import { getErrorMessage, getErrorStatus } from '@/api/errors';
import { formatIsoDate } from '@/lib/format-date';
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

function StatusHero({
  status,
  rejectionReason,
  stale,
}: {
  status: ProfessionalApplicationStatus;
  rejectionReason?: string | null;
  stale?: boolean;
}) {
  const theme = useTheme();
  const color = statusColor(theme, status);

  return (
    <View className="items-center gap-3 py-8">
      <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: color + '15' }}>
        <Ionicons name={STATUS_ICON[status]} size={32} color={color} />
      </View>
      <ThemedText className="text-xl font-semibold">{STATUS_LABEL[status]}</ThemedText>
      {status === 'processing' ? (
        <ThemedText color="mutedForeground" className="text-center">
          We're verifying your ID and identity. This usually takes a minute.
        </ThemedText>
      ) : null}
      {status === 'pending_review' ? (
        <ThemedText color="mutedForeground" className="text-center">
          Your application passed automatic checks and is now waiting for admin review.
        </ThemedText>
      ) : null}
      {rejectionReason ? (
        <Card className="mt-2 w-full">
          <ThemedText type="small" color="destructive">
            {rejectionReason}
          </ThemedText>
        </Card>
      ) : null}
      {stale ? (
        <ThemedText type="small" color="mutedForeground" className="text-center">
          Showing the last known update — full details aren't available right now.
        </ThemedText>
      ) : null}
    </View>
  );
}

export default function ProfessionalApplicationStatusScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const applicationId = Number(id);
  const { data: application, isError, error } = useProfessionalApplication(applicationId);
  const { data: myApplication } = useMyProfessionalApplication();
  const { data: broadcastStatus } = useProfessionalApplicationBroadcastStatus(applicationId);

  // The GET-by-id can still fail (network error, or the application was pruned days after
  // denial — see ProfessionalApplicationService::prune() on the backend) even though we have a
  // more durable source: the "my latest application" query, which reflects the same record
  // regardless of whether this device was connected when any realtime event fired. Prefer that,
  // then fall back further to the realtime broadcast (session-only, may be empty), before giving
  // up on a generic error/loading screen.
  if (!application) {
    if (myApplication && myApplication.id === applicationId) {
      return (
        <AppLayout>
          <StatusHero status={myApplication.status} rejectionReason={myApplication.rejection_reason} stale />
          <PrimaryButton label="Back to account" onPress={() => router.replace('/account')} />
        </AppLayout>
      );
    }

    if (broadcastStatus) {
      return (
        <AppLayout>
          <StatusHero status={broadcastStatus} stale />
          <PrimaryButton label="Back to account" onPress={() => router.replace('/account')} />
        </AppLayout>
      );
    }

    if (isError) {
      return (
        <AppLayout>
          <StatusFallbackError isNotFound={getErrorStatus(error) === 404} error={error} onBack={() => router.replace('/account')} />
        </AppLayout>
      );
    }

    return (
      <AppLayout>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <StatusHero status={application.status} rejectionReason={application.rejection_reason} />
    </AppLayout>
  );
}

function StatusFallbackError({ isNotFound, error, onBack }: { isNotFound: boolean; error: unknown; onBack: () => void }) {
  const theme = useTheme();
  return (
    <View className="items-center gap-3 py-8">
      <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: theme.destructive + '15' }}>
        <Ionicons name="alert-circle" size={32} color={theme.destructive} />
      </View>
      <ThemedText className="text-xl font-semibold">
        {isNotFound ? 'Application not found' : 'Something went wrong'}
      </ThemedText>
      <ThemedText color="mutedForeground" className="text-center">
        {isNotFound
          ? "This application is no longer available — it may have been withdrawn or removed after review."
          : getErrorMessage(error)}
      </ThemedText>
      <PrimaryButton label="Back to account" className="mt-2" onPress={onBack} />
    </View>
  );
}
