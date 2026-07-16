import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/auth/useAuth';
import { useTheme } from '@/hooks/use-theme';
import { useSendEmailVerification } from '@/features/account/useSendEmailVerification';

export function EmailVerificationBanner() {
  const { user } = useAuth();
  const theme = useTheme();
  const { mutate: send, isPending } = useSendEmailVerification();
  const [dismissed, setDismissed] = useState(false);

  if (!user || user.email_verified_at || dismissed) return null;

  return (
    <View className="mx-5 mb-4 flex-row items-center gap-3 rounded-xl px-4 py-3" style={{ backgroundColor: theme.warning + '1a', borderColor: theme.warning + '4d', borderWidth: 1 }}>
      <Ionicons name="mail-unread" size={18} color={theme.warning} />
      <ThemedText type="small" color="mutedForeground" className="flex-1">
        Verify your email to secure your account.
      </ThemedText>
      <Pressable onPress={() => send()} disabled={isPending} hitSlop={8}>
        <ThemedText type="small" color="primary" className="font-semibold">
          {isPending ? 'Sending…' : 'Resend'}
        </ThemedText>
      </Pressable>
      <Pressable onPress={() => setDismissed(true)} hitSlop={8}>
        <Ionicons name="close" size={18} color={theme.mutedForeground} />
      </Pressable>
    </View>
  );
}
