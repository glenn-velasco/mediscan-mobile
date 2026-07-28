import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { AuthLayout } from '@/components/layouts/auth-layout';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/auth/useAuth';
import { useTheme } from '@/hooks/use-theme';

/**
 * Deep link target for email verification.
 *
 * The backend's `MobileVerifyEmailController` verifies the signed URL
 * and redirects here via `mediscanmobile://email-verified`. This screen
 * calls `refreshUser()` to pull the updated `email_verified_at`, shows
 * a brief success message, and auto-navigates to the appropriate screen.
 *
 * Accessible regardless of auth state (registered in the `guard={ready}`
 * block in `_layout.tsx`).
 */
export default function EmailVerifiedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { status, refreshUser } = useAuth();
  const [refreshed, setRefreshed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // react-doctor-disable-next-line react-hooks-js/todo
      try {
        await refreshUser();
      } catch {
        // Offline or network error — Pusher event will catch it later.
      } finally {
        if (!cancelled) setRefreshed(true);
      }
    })();

    return () => { cancelled = true; };
  }, [refreshUser]);

  useEffect(() => {
    if (!refreshed) return;

    const timer = setTimeout(() => {
      if (status === 'authenticated') {
        router.replace('/(app)');
      } else {
        router.replace('/(auth)');
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [refreshed, status, router]);

  return (
    <AuthLayout>
      <View className="items-center gap-4">
        <View
          className="h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: theme.primary + '15' }}
        >
          <Ionicons name="checkmark-circle" size={32} color={theme.primary} />
        </View>
        <ThemedText type="screenTitle" className="text-center">
          Email verified
        </ThemedText>
        <ThemedText color="mutedForeground" className="text-center">
          Your email address has been verified successfully.
        </ThemedText>
        <PrimaryButton
          label={status === 'authenticated' ? 'Go to home' : 'Go to login'}
          className="mt-4 w-sm"
          onPress={() => {
            if (status === 'authenticated') {
              router.replace('/(app)');
            } else {
              router.replace('/(auth)');
            }
          }}
        />
      </View>
    </AuthLayout>
  );
}
