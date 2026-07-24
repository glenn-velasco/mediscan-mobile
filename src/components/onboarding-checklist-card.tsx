import { Pressable, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type OnboardingChecklistCardProps = {
  doneCount: number;
  total: number;
  onPress: () => void;
};

export function OnboardingChecklistCard({ doneCount, total, onPress }: OnboardingChecklistCardProps) {
  const theme = useTheme();
  const progress = total > 0 ? doneCount / total : 0;

  return (
    <Pressable onPress={onPress}>
      <Card className="mb-6 gap-3">
        <View className="gap-1">
          <ThemedText className="font-semibold">Finish setting up your profile</ThemedText>
          <ThemedText type="small" color="mutedForeground">
            {doneCount} of {total} done — a few quick, optional steps.
          </ThemedText>
        </View>
        <View className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: theme.muted }}>
          <View className="h-full rounded-full" style={{ width: `${progress * 100}%`, backgroundColor: theme.primary }} />
        </View>
      </Card>
    </Pressable>
  );
}
