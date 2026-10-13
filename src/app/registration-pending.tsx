import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AuthLayout } from '@/components/layouts/auth-layout';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** Shown when Supabase created the account but requires email confirmation. */
export default function RegistrationPendingScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <AuthLayout>
      <View className="items-center gap-4">
        <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: theme.warning + '15' }}>
          <Ionicons name="mail-unread-outline" size={32} color={theme.warning} />
        </View>
        <ThemedText type="screenTitle" className="text-center">Check your email</ThemedText>
        <ThemedText color="mutedForeground" className="text-center">
          Your account was created. Open the verification link we sent to your email, then return here and log in.
        </ThemedText>
        <PrimaryButton label="Back to login" className="mt-4 w-sm" onPress={() => router.replace('/(auth)')} />
      </View>
    </AuthLayout>
  );
}
