import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { AuthLayout } from '@/components/layouts/auth-layout';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/**
 * Shown right after registering when the submitted name+dob matched an
 * existing primary-owned medical record - no account was created (see
 * MedicalInformationRegistrationMatchService::createForPendingRegistration()
 * on the backend), so there's no session here to gate, poll, or log out of.
 * Purely informational: the person finds out what to do next by email.
 */
export default function RegistrationPendingScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <AuthLayout>
      <View className="items-center gap-4">
        <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: theme.warning + '15' }}>
          <Ionicons name="mail-unread-outline" size={32} color={theme.warning} />
        </View>
        <ThemedText type="screenTitle" className="text-center">Registration received</ThemedText>
        <ThemedText color="mutedForeground" className="text-center">
          Someone with an existing medical record needs to confirm this is you before your account is created. We&apos;ll
          email you once it&apos;s approved.
        </ThemedText>
        <PrimaryButton label="Back to login" className="mt-4 w-sm" onPress={() => router.replace('/(auth)')} />
      </View>
    </AuthLayout>
  );
}
