import { Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/hooks/use-theme';
import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';

function AddDiagnosisButton() {
  const router = useRouter();
  const theme = useTheme();
  return (
    <Pressable onPress={() => router.push('/diagnoses/new')} hitSlop={12}>
      <Ionicons name="add" size={26} color={theme.primary} />
    </Pressable>
  );
}

export default function DiagnosesStackLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'Diagnoses', headerRight: () => <AddDiagnosisButton /> }} />
      <Stack.Screen name="new" options={{ title: 'Add diagnosis', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Edit diagnosis' }} />
    </Stack>
  );
}
