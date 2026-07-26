import { ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AppLayout } from '@/components/layouts/app-layout';
import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { useDecideRegistrationMatch, usePendingRegistrationMatchesToReview } from '@/features/registration-match/usePendingRegistrationMatch';
import { useTheme } from '@/hooks/use-theme';
import { getErrorMessage } from '@/api/errors';

export default function RegistrationMatchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = Number(id);

  const { data: matches, isLoading, isError, error, refetch } = usePendingRegistrationMatchesToReview();
  const match = matches?.find((m) => m.id === matchId);
  const { accept, deny } = useDecideRegistrationMatch(matchId);

  const back = () => router.replace('/notifications');

  if (isLoading) {
    return (
      <AppLayout>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </AppLayout>
    );
  }

  // Distinct from "genuinely nothing to review" below - an auth/network failure here shouldn't
  // silently look like the request was already resolved.
  if (isError) {
    return (
      <AppLayout>
        <View className="items-center gap-3 py-8">
          <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: theme.destructive + '15' }}>
            <Ionicons name="alert-circle" size={32} color={theme.destructive} />
          </View>
          <ThemedText className="text-xl font-semibold">Something went wrong</ThemedText>
          <ThemedText color="mutedForeground" className="text-center">
            {getErrorMessage(error)}
          </ThemedText>
          <PrimaryButton label="Try again" className="mt-2" onPress={() => refetch()} />
        </View>
      </AppLayout>
    );
  }

  if (!match) {
    return (
      <AppLayout>
        <View className="items-center gap-3 py-8">
          <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: theme.mutedForeground + '15' }}>
            <Ionicons name="checkmark-done-circle" size={32} color={theme.mutedForeground} />
          </View>
          <ThemedText className="text-xl font-semibold">Nothing to review</ThemedText>
          <ThemedText color="mutedForeground" className="text-center">
            This request has already been resolved or is no longer available.
          </ThemedText>
          <PrimaryButton label="Back to notifications" className="mt-2" onPress={back} />
        </View>
      </AppLayout>
    );
  }

  const mutationError = accept.error ?? deny.error;
  const busy = accept.isPending || deny.isPending;

  return (
    <AppLayout>
      <View className="items-center gap-3 py-8">
        <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: theme.warning + '15' }}>
          <Ionicons name="help-circle" size={32} color={theme.warning} />
        </View>
        <ThemedText className="text-xl font-semibold">Verification needed</ThemedText>
        <ThemedText color="mutedForeground" className="text-center">
          Someone registered for an account claiming to be linked to your medical record. Was this you?
        </ThemedText>
      </View>

      <Card className="gap-1">
        <ThemedText type="small" color="mutedForeground">
          If this was you, accept to link your accounts. If you don't recognize this, deny it — the registration will be removed.
        </ThemedText>
      </Card>

      {mutationError ? (
        <ThemedText type="small" color="destructive">
          {getErrorMessage(mutationError)}
        </ThemedText>
      ) : null}

      <PrimaryButton
        label="Yes, this was me"
        loading={accept.isPending}
        disabled={busy}
        onPress={() => accept.mutate(undefined, { onSuccess: back })}
      />
      <PrimaryButton
        label="No, deny this request"
        variant="danger"
        loading={deny.isPending}
        disabled={busy}
        className="mt-2"
        onPress={() => deny.mutate(undefined, { onSuccess: back })}
      />
    </AppLayout>
  );
}
