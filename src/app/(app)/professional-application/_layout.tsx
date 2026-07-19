import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';

export default function ProfessionalApplicationLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="create" options={{ title: 'Get verified' }} />
      <Stack.Screen name="[id]" options={{ title: 'Application status' }} />
    </Stack>
  );
}
