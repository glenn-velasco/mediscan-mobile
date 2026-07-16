import { memo } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** Small chip showing how many professionals have verified a record. Count only — names live on the detail screen. */
export const VerifiedCountBadge = memo(function VerifiedCountBadge({ count }: { count: number }) {
  const theme = useTheme();
  if (count <= 0) return null;

  return (
    <View
      className="flex-row items-center gap-1 rounded-full px-2 py-0.5"
      style={{ backgroundColor: theme.success + '1a' }}
      accessibilityRole="text"
      accessibilityLabel={`Verified by ${count} professional${count === 1 ? '' : 's'}`}
    >
      <Ionicons name="checkmark-done" size={12} color={theme.success} />
      <ThemedText type="detail" style={{ color: theme.success }}>
        {count}
      </ThemedText>
    </View>
  );
});
