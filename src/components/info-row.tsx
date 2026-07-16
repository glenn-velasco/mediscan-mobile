import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { cn } from '@/lib/cn';

export function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View className={cn('flex-row items-center justify-between py-3', !last && 'border-b border-border')}>
      <ThemedText type="small" color="mutedForeground">
        {label}
      </ThemedText>
      <ThemedText className="ml-4 shrink text-right">{value}</ThemedText>
    </View>
  );
}
