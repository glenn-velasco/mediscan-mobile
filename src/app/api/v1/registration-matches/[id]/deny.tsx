import { useEffect } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { AppLayout } from '@/components/layouts/app-layout';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/**
 * App Links catch route for registration match deny.
 *
 * When the app is opened via an HTTPS deny link
 * (e.g. https://app.mediscan.cloud/api/v1/registration-matches/5/deny),
 * Android's App Links intercept the URL and open the app directly.
 * This route triggers the server-side deny action via HTTP, then
 * navigates to the registration match screen.
 */
export default function RegistrationMatchDenyRedirectScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const url = `https://app.mediscan.cloud/api/v1/registration-matches/${id}/deny`;
        await fetch(url, { method: 'GET' });
      } catch {
        // Network error — action may not have completed.
      } finally {
        if (!cancelled) router.replace(`/registration-match/${id}`);
      }
    })();

    return () => { cancelled = true; };
  }, [id, router]);

  return (
    <AppLayout>
      <View className="flex-1 items-center justify-center gap-4">
        <ActivityIndicator size="large" color={theme.primary} />
        <ThemedText color="mutedForeground">Denying...</ThemedText>
      </View>
    </AppLayout>
  );
}
