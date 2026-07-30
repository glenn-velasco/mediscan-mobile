import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { useSendEmailVerification } from '@/features/account/useSendEmailVerification';
import { addNotification } from '@/features/notifications/notifications.store';
import { useTheme } from '@/hooks/use-theme';
import { type OnboardingTaskId } from '@/onboarding/useOnboardingChecklist';
import { useOnboardingData } from '@/onboarding/useOnboardingData';

const TASK_ROUTE: Partial<Record<OnboardingTaskId, string>> = {
  emergency_contacts: '/emergency-contacts/new',
  allergies: '/allergies/new',
  conditions: '/conditions/new',
  medications: '/medications/new',
};

function AnimatedProgressBar({ progress, color, backgroundColor }: { progress: number; color: string; backgroundColor: string }) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.set(withSpring(progress * 100, { damping: 15, stiffness: 120 }));
  }, [progress, width]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  return (
    <View className="h-2.5 overflow-hidden rounded-full" style={{ backgroundColor }}>
      <Animated.View className="h-full rounded-full" style={[{ backgroundColor: color }, animatedStyle]} />
    </View>
  );
}

function TaskCard({
  task,
  theme,
  disabled,
  index,
  cooldown,
  onPress,
  onSkip,
}: {
  task: { id: OnboardingTaskId; title: string; body: string; icon: 'mail' | 'people' | 'medical' | 'medkit' | 'bandage' | 'fitness'; done: boolean; skippable: boolean };
  theme: ReturnType<typeof useTheme>;
  disabled: boolean;
  index: number;
  cooldown?: number;
  onPress: () => void;
  onSkip: () => void;
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
        disabled={task.done || disabled || (cooldown != null && cooldown > 0)}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View entering={FadeInDown.delay(index * 80).springify().damping(15).stiffness(120)}>
          <Animated.View style={animatedStyle}>
          <Card className="flex-row items-center gap-3">
            <View
              className="h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: task.done ? theme.success + '15' : theme.primary + '15' }}
            >
              <Ionicons name={task.done ? 'checkmark' : task.icon} size={20} color={task.done ? theme.success : theme.primary} />
            </View>
            <View className="flex-1">
              <ThemedText
                className="font-semibold"
                style={task.done ? { textDecorationLine: 'line-through', color: theme.mutedForeground } : undefined}
              >
                {task.title}
              </ThemedText>
              <ThemedText type="small" color="mutedForeground">
                {disabled ? 'Sending…' : (cooldown != null && cooldown > 0) ? 'Email sent, check your inbox' : task.body}
              </ThemedText>
            </View>
            {!task.done && !(cooldown != null && cooldown > 0) ? <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} /> : null}
          </Card>
          </Animated.View>
        </Animated.View>
      </Pressable>
      {!task.done && task.skippable ? (
        <Pressable onPress={onSkip} className="self-end py-1 pr-1" hitSlop={8}>
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

export default function OnboardingTasksScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { isDataReady, checklist } = useOnboardingData();
  const { mutateAsync: sendEmailVerification, isPending: isSendingVerification } = useSendEmailVerification();
  const [emailCooldown, setEmailCooldown] = useState(0);
  const emailSendCount = useRef(0);

  console.log('[OnboardingTasks] mounted', { isDataReady, complete: checklist.complete, doneCount: checklist.doneCount, total: checklist.total, visible: checklist.visible });

  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = setTimeout(() => setEmailCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [emailCooldown]);

  const dismissedRef = useRef(false);

  useEffect(() => {
    if (isDataReady && checklist.complete && !dismissedRef.current) {
      console.log('[OnboardingTasks] auto-dismissing (all tasks complete)');
      dismissedRef.current = true;
      router.dismissAll();
    }
  }, [isDataReady, checklist.complete]);

  useFocusEffect(
    () => {
      void checklist.refreshSkipped();
    }
  );

  if (!isDataReady) {
    console.log('[OnboardingTasks] showing spinner (isDataReady=false)');
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.background }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (checklist.complete) {
    console.log('[OnboardingTasks] checklist complete, returning null');
    return null;
  }

  const handleSkipTask = (id: OnboardingTaskId) => {
    void checklist.skipTask(id);
  };

  const handleSelectTask = async (id: OnboardingTaskId) => {
    if (id === 'email_verified') {
      if (isSendingVerification || emailCooldown > 0) return;
      await sendEmailVerification();
      emailSendCount.current += 1;
      setEmailCooldown(20 + (emailSendCount.current - 1) * 10);
      await addNotification({ title: 'Verification email sent', body: 'Check your inbox to confirm your email address.' });
      return;
    }
    const route = TASK_ROUTE[id];
    if (route) router.push(route as never);
  };

  const handleClose = () => {
    router.replace('/');
  };

  const progress = checklist.total > 0 ? checklist.doneCount / checklist.total : 0;

  return (
    <View className="flex-1" style={{ backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="items-end px-5 pt-2">
        <Pressable onPress={handleClose} hitSlop={8}>
          <ThemedText type="linkPrimary">Skip for now</ThemedText>
        </Pressable>
      </View>

      <View className="items-center px-6 pb-2 pt-4">
        <View className="mb-4 h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: theme.primary + '1a' }}>
          <Ionicons name="trophy" size={36} color={theme.primary} />
        </View>
        <ThemedText type="title" className="mb-2 text-center">
          Let&apos;s finish your profile
        </ThemedText>
        <ThemedText type="body" color="mutedForeground" className="text-center">
          A few quick, optional steps so your medical profile is ready when it matters most.
        </ThemedText>
      </View>

      <View className="px-6 pb-2 pt-4">
        <View className="mb-2 flex-row items-center justify-between">
          <ThemedText type="small" color="mutedForeground">
            {checklist.doneCount} of {checklist.total} complete
          </ThemedText>
          <ThemedText type="smallBold" color="primary">
            {Math.round(progress * 100)}%
          </ThemedText>
        </View>
        <AnimatedProgressBar progress={progress} color={theme.primary} backgroundColor={theme.muted} />
      </View>

      <FlatList
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, gap: 12 }}
        contentInset={{ bottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        data={checklist.tasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item: task, index }) => (
          <TaskCard
            task={task}
            theme={theme}
            disabled={task.id === 'email_verified' && isSendingVerification}
            index={index}
            cooldown={task.id === 'email_verified' ? emailCooldown : undefined}
            onPress={() => void handleSelectTask(task.id)}
            onSkip={() => handleSkipTask(task.id)}
          />
        )}
      />
    </View>
  );
}
