import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/useAuth';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/card';
import { useAllergies } from '@/features/allergies/useAllergies';
import { useSendEmailVerification } from '@/features/account/useSendEmailVerification';
import { useEmergencyContacts } from '@/features/emergency-contacts';
import { useMedications } from '@/features/medications/useMedications';
import { addNotification } from '@/features/notifications/notifications.store';
import { useTheme } from '@/hooks/use-theme';
import { useOnboardingChecklist, type OnboardingTaskId } from '@/onboarding/useOnboardingChecklist';

const TASK_ROUTE: Partial<Record<OnboardingTaskId, string>> = {
  emergency_contacts: '/emergency-contacts/new',
  allergies: '/allergies/new',
  medications: '/medications/new',
};

export default function OnboardingTasksScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: allergies = [] } = useAllergies();
  const { data: medications = [] } = useMedications();
  const { data: emergencyContacts = [] } = useEmergencyContacts();
  const { mutateAsync: sendEmailVerification, isPending: isSendingVerification } = useSendEmailVerification();

  const checklist = useOnboardingChecklist({
    userId: user?.id,
    emailVerified: !!user?.email_verified_at,
    hasEmergencyContacts: emergencyContacts.length > 0,
    hasAllergies: allergies.length > 0,
    hasMedications: medications.length > 0,
  });

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
    void checklist.dismiss();
    router.back();
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
        <View className="h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: theme.muted }}>
          <View className="h-full rounded-full" style={{ width: `${progress * 100}%`, backgroundColor: theme.primary }} />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: insets.bottom + 24, gap: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {checklist.tasks.map((task) => (
          <Pressable
            key={task.id}
            disabled={task.done || (task.id === 'email_verified' && isSendingVerification)}
            onPress={() => void handleSelectTask(task.id)}
          >
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
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
