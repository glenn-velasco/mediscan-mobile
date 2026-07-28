import { Ionicons } from '@expo/vector-icons';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { sheet } from '@/components/form/tokens';
import { useTheme } from '@/hooks/use-theme';
import type { OnboardingTask, OnboardingTaskId } from '@/onboarding/useOnboardingChecklist';

export type OnboardingChecklistSheetHandle = {
  present: () => void;
  dismiss: () => void;
};

type OnboardingChecklistSheetProps = {
  tasks: OnboardingTask[];
  onSelectTask: (id: OnboardingTaskId) => void;
  onSkipTask: (id: OnboardingTaskId) => void;
  sendingVerification?: boolean;
  emailCooldown?: number;
};

function renderBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />;
}

function SheetTaskItem({
  task,
  theme,
  onSelect,
  onSkip,
  loading,
  cooldown,
}: {
  task: OnboardingTask;
  theme: ReturnType<typeof useTheme>;
  onSelect: () => void;
  onSkip: () => void;
  loading?: boolean;
  cooldown?: number;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.set(withSpring(0.97, { damping: 15, stiffness: 400 }));
    opacity.set(withTiming(0.7, { duration: 100 }));
  };

  const handlePressOut = () => {
    scale.set(withSpring(1, { damping: 15, stiffness: 400 }));
    opacity.set(withTiming(1, { duration: 100 }));
  };

  return (
    <View>
      <Pressable
        disabled={task.done || loading || (cooldown != null && cooldown > 0)}
        onPress={onSelect}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        className="flex-row items-center gap-3 py-3"
      >
        <Animated.View style={animatedStyle} className="flex-1 flex-row items-center gap-3">
          <View
            className="h-9 w-9 items-center justify-center rounded-lg"
            style={{ backgroundColor: task.done ? theme.success + '15' : theme.muted }}
          >
            {loading ? (
              <ActivityIndicator size={18} color={theme.mutedForeground} />
            ) : (
              <Ionicons name={task.done ? 'checkmark' : task.icon} size={18} color={task.done ? theme.success : theme.mutedForeground} />
            )}
          </View>
          <View className="flex-1">
            <ThemedText className={task.done ? 'font-semibold' : undefined} style={task.done ? { textDecorationLine: 'line-through', color: theme.mutedForeground } : undefined}>
              {task.title}
            </ThemedText>
            <ThemedText type="small" color="mutedForeground">
              {loading ? 'Sending…' : (cooldown != null && cooldown > 0) ? 'Email sent, check your inbox' : task.body}
            </ThemedText>
          </View>
          {!task.done && !(cooldown != null && cooldown > 0) ? <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} /> : null}
        </Animated.View>
      </Pressable>
      {!task.done && task.skippable ? (
        <Pressable onPress={onSkip} className="self-end py-1" hitSlop={8}>
          {({ pressed }) => (
            <ThemedText type="small" color="mutedForeground" style={pressed ? { opacity: 0.5 } : undefined}>
              Skip
            </ThemedText>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

export const OnboardingChecklistSheet = forwardRef<OnboardingChecklistSheetHandle, OnboardingChecklistSheetProps>(
  function OnboardingChecklistSheet({ tasks, onSelectTask, onSkipTask, sendingVerification, emailCooldown }, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const theme = useTheme();

    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }), []);

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['60%']}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: theme.background, borderRadius: sheet.radius }}
        handleIndicatorStyle={{ backgroundColor: theme.border, width: sheet.handleWidth }}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={{ paddingHorizontal: sheet.paddingH, paddingBottom: 32, gap: 4 }}>
          <ThemedText type="heading" className="mb-2">Finish setting up</ThemedText>
          {tasks.map((task) => (
            <SheetTaskItem
              key={task.id}
              task={task}
              theme={theme}
              onSelect={() => onSelectTask(task.id)}
              onSkip={() => onSkipTask(task.id)}
              loading={task.id === 'email_verified' && sendingVerification}
              cooldown={task.id === 'email_verified' ? emailCooldown : undefined}
            />
          ))}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);
