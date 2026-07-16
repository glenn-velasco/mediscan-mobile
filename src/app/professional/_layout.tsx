import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';

export default function ProfessionalStackLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'Professional mode' }} />
      <Stack.Screen name="scan" options={{ title: 'Scan patient code' }} />
      <Stack.Screen name="submit" options={{ title: 'Submit update' }} />
      <Stack.Screen name="manage/[patientId]" options={{ title: 'Manage info' }} />
    </Stack>
  );
}
