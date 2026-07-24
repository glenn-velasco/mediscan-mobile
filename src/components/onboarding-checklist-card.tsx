import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type OnboardingChecklistCardProps = {
  doneCount: number;
  total: number;
  onPress: () => void;
  onDismiss: () => void;
};

export function OnboardingChecklistCard({ doneCount, total, onPress, onDismiss }: OnboardingChecklistCardProps) {
  const theme = useTheme();
  const progress = total > 0 ? doneCount / total : 0;

  return (
    <Pressable onPress={onPress}>
      <Card className="mb-6 gap-3">
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1 gap-1">
            <ThemedText className="font-semibold">Finish setting up your profile</ThemedText>
            <ThemedText type="small" color="mutedForeground">
              {doneCount} of {total} done — a few quick, optional steps.
            </ThemedText>
          </View>
          <Pressable onPress={onDismiss} hitSlop={8} accessibilityLabel="Dismiss">
            <Ionicons name="close" size={18} color={theme.mutedForeground} />
          </Pressable>
        </View>
        <View className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: theme.muted }}>
          <View className="h-full rounded-full" style={{ width: `${progress * 100}%`, backgroundColor: theme.primary }} />
        </View>
      </Card>
    </Pressable>
  );
}
