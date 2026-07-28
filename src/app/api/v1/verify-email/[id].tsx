import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { useAuth } from '@/auth/useAuth';
import { AuthLayout } from '@/components/layouts/auth-layout';
import { ThemedText } from '@/components/themed-text';
import { View } from 'react-native';

/**
 * Catch-all route for App Links deep links.
 *
 * When the app is opened via an HTTPS verification link
 * (e.g. https://app.mediscan.cloud/api/v1/verify-email/21/hash),
 * Android's App Links intercept the URL and open the app directly.
 * Expo Router matches this to /api/v1/verify-email/[id], which
 * redirects to the actual email-verified screen.
 */
export default function VerifyEmailRedirectScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await refreshUser();
      } catch {
        // Offline — Pusher event will catch it later.
      } finally {
        if (!cancelled) router.replace('/email-verified');
      }
    })();

    return () => { cancelled = true; };
  }, [refreshUser, router]);

  return (
    <AuthLayout>
      <View className="items-center gap-4">
        <ThemedText className="text-center">Verifying...</ThemedText>
      </View>
    </AuthLayout>
  );
}
