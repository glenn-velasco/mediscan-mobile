import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';

export default function AppLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
    </Stack>
  );
}
