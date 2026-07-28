import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { AppLayout } from '@/components/layouts/app-layout';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/**
 * App Links catch route for account retrieval request status.
 *
 * When the app is opened via an HTTPS link
 * (e.g. https://app.mediscan.cloud/api/v1/account-retrieval-requests/5),
 * Android's App Links intercept the URL and open the app directly.
 * This route fetches the request status from the API, then navigates
 * to the account retrieval screen with the status.
 */
export default function AccountRetrievalRedirectScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // Fetch the request status from the API
        const response = await fetch(`https://app.mediscan.cloud/api/v1/account-retrieval-requests/${id}`);
        const data = await response.json();
        const status = data?.data?.status ?? 'pending';

        if (!cancelled) {
          router.replace(`/account-retrieval/${id}?status=${status}`);
        }
      } catch {
        // Network error — navigate without status
        if (!cancelled) {
          router.replace(`/account-retrieval/${id}?status=pending`);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [id, router]);

  return (
    <AppLayout>
      <View className="flex-1 items-center justify-center gap-4">
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText color="mutedForeground">Loading...</ThemedText>
      </View>
    </AppLayout>
  );
}
