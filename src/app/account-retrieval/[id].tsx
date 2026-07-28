import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AppLayout } from '@/components/layouts/app-layout';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/auth/useAuth';
import { useTheme } from '@/hooks/use-theme';

/**
 * Deep link target for account retrieval request status.
 *
 * The backend's `AccountRetrievalController` redirects here via
 * `mediscanmobile://account-retrieval/{id}?status=approved|denied`.
 * Shows the outcome and a continue button to navigate home.
 *
 * Accessible only when authenticated (registered under the
 * `guard={authenticated}` block in `_layout.tsx`).
 */
export default function AccountRetrievalScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { status } = useLocalSearchParams<{ id: string; status: string }>();
  const { refreshUser } = useAuth();

  const approved = status === 'approved';

  const handleContinue = async () => {
    if (approved) {
      try {
        await refreshUser();
      } catch {
        // Offline — data will sync later.
      }
    }
    router.replace('/(app)');
  };

  return (
    <AppLayout>
      <View className="items-center gap-3 py-8">
        <View
          className="h-16 w-16 items-center justify-center rounded-full"
          style={{
            backgroundColor: approved ? theme.primary + '15' : theme.destructive + '15',
          }}
        >
          <Ionicons
            name={approved ? 'checkmark-circle' : 'close-circle'}
            size={32}
            color={approved ? theme.primary : theme.destructive}
          />
        </View>
        <ThemedText type="screenTitle" className="text-center">
          {approved ? 'Medical information recovered' : 'Request denied'}
        </ThemedText>
        <ThemedText color="mutedForeground" className="text-center">
          {approved
            ? 'Your medical information is now linked to your account.'
            : 'Unfortunately your account retrieval request has been denied. You may submit a new request if you believe this was an error.'}
        </ThemedText>
      </View>

      <PrimaryButton label="Continue" className="mt-4" onPress={handleContinue} />
    </AppLayout>
  );
}
