import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/hooks/use-theme';

/** Compact "Show my QR" shortcut — a small circular icon button, meant to sit beside identity info. */
export function QrIconButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      className="h-10 w-10 items-center justify-center rounded-full"
      style={{ backgroundColor: theme.primary }}
      hitSlop={12}
      accessibilityLabel="Show my QR"
    >
      <Ionicons name="qr-code" size={20} color={theme.primaryForeground} />
    </Pressable>
  );
}
