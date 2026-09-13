import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function StackBackButton() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => {
        if (router.canGoBack()) router.back();
      }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Back"
      style={{ height: 40, justifyContent: 'center', alignItems: 'flex-start' }}
    >
      <Ionicons name="arrow-back" size={24} color={theme.foreground} />
    </Pressable>
  );
}
