import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

export function ConflictBanner({ message, className }: { message: string; className?: string }) {
  const theme = useTheme();
  return (
    <View className={cn('rounded-md p-3', className)} style={{ backgroundColor: theme.warning + '26' }}>
      <ThemedText type="small" style={{ color: theme.warning }}>
        ⚠ {message}
      </ThemedText>
    </View>
  );
}
