import { Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/hooks/use-theme';
import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';
import { useGuardedPress } from '@/lib/use-guarded-press';

function AddAllergyButton() {
  const router = useRouter();
  const theme = useTheme();
  const onPress = useGuardedPress(() => router.push('/allergies/new'));
  return (
    <Pressable onPress={onPress} hitSlop={12}>
      <Ionicons name="add" size={26} color={theme.primary} />
    </Pressable>
  );
}

export default function AllergiesStackLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'Allergies', headerRight: () => <AddAllergyButton /> }} />
      <Stack.Screen name="new" options={{ title: 'Add allergy', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Edit allergy' }} />
    </Stack>
  );
}
