import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function EmptyState({ title, body, icon }: { title: string; body: string; icon?: string }) {
  const theme = useTheme();
  return (
    <View className="items-center justify-center gap-3 px-6 py-8">
      {icon ? (
        <View
          className="mb-2 h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: theme.muted }}
        >
          <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={28} color={theme.mutedForeground} />
        </View>
      ) : null}
      <ThemedText type="heading" className="text-center">{title}</ThemedText>
      <ThemedText type="body" color="mutedForeground" className="max-w-xs text-center">
        {body}
      </ThemedText>
    </View>
  );
}
