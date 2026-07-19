import { Pressable, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/hooks/use-theme';

/** Compact "Show my QR" shortcut — a circular icon button. `size` lets it double as the floating center button in the bottom nav bar. */
export function QrIconButton({ onPress, size = 40, style }: { onPress: () => void; size?: number; style?: ViewStyle }) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      className="items-center justify-center rounded-full"
      style={[{ width: size, height: size, backgroundColor: theme.primary }, style]}
      hitSlop={12}
      accessibilityLabel="Show my QR"
    >
      <Ionicons name="qr-code" size={Math.round(size * 0.5)} color={theme.primaryForeground} />
    </Pressable>
  );
}
