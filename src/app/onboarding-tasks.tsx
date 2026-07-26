import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/useAuth';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { useSendEmailVerification } from '@/features/account/useSendEmailVerification';
import { useAllergies } from '@/features/allergies/useAllergies';
import { useConditions } from '@/features/conditions/useConditions';
import { useEmergencyContacts } from '@/features/emergency-contacts';
import { useMedications } from '@/features/medications/useMedications';
import { addNotification } from '@/features/notifications/notifications.store';
import { useTheme } from '@/hooks/use-theme';
import { useOnboardingChecklist, type OnboardingTaskId } from '@/onboarding/useOnboardingChecklist';

const TASK_ROUTE: Partial<Record<OnboardingTaskId, string>> = {
  emergency_contacts: '/emergency-contacts/new',
  allergies: '/allergies/new',
  conditions: '/conditions/new',
  medications: '/medications/new',
};

function AnimatedProgressBar({ progress, color, backgroundColor }: { progress: number; color: string; backgroundColor: string }) {
  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withSpring(progress * 100, { damping: 15, stiffness: 120 });
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
  onPress,
  onSkip,
}: {
  task: { id: OnboardingTaskId; title: string; body: string; icon: 'mail' | 'people' | 'medical' | 'medkit' | 'bandage' | 'fitness'; done: boolean; skippable: boolean };
  theme: ReturnType<typeof useTheme>;
  disabled: boolean;
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
    scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
    opacity.value = withTiming(0.7, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    opacity.value = withTiming(1, { duration: 100 });
  };

  return (
    <View>
      <Pressable
        disabled={task.done || disabled}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
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
                {task.body}
              </ThemedText>
            </View>
            {!task.done ? <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} /> : null}
          </Card>
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
  const { user } = useAuth();
  const { data: allergies = [] } = useAllergies();
  const { data: conditions = [] } = useConditions();
  const { data: medications = [] } = useMedications();
  const { data: emergencyContacts = [] } = useEmergencyContacts();
  const { mutateAsync: sendEmailVerification, isPending: isSendingVerification } = useSendEmailVerification();

  const checklist = useOnboardingChecklist({
    userId: user?.id,
    emailVerified: !!user?.email_verified_at,
    hasEmergencyContacts: emergencyContacts.length > 0,
    hasAllergies: allergies.length > 0,
    hasConditions: conditions.length > 0,
    hasMedications: medications.length > 0,
  });

  useEffect(() => {
    if (checklist.complete) {
      const timer = setTimeout(() => router.replace('/'), 800);
      return () => clearTimeout(timer);
    }
  }, [checklist.complete]);

  const handleSkipTask = (id: OnboardingTaskId) => {
    void checklist.skipTask(id);
  };

  useFocusEffect(
    useCallback(() => {
      void checklist.refreshSkipped();
    }, [checklist.refreshSkipped])
  );

  const handleSelectTask = async (id: OnboardingTaskId) => {
    if (id === 'email_verified') {
      await sendEmailVerification();
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
          Let's finish your profile
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
          <ThemedText type="small" color="primary" className="font-semibold">
            {Math.round(progress * 100)}%
          </ThemedText>
        </View>
        <AnimatedProgressBar progress={progress} color={theme.primary} backgroundColor={theme.muted} />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: insets.bottom + 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {checklist.tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            theme={theme}
            disabled={task.id === 'email_verified' && isSendingVerification}
            onPress={() => void handleSelectTask(task.id)}
            onSkip={() => handleSkipTask(task.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
