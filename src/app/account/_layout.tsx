import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';

export default function AccountStackLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'Account' }} />
      <Stack.Screen name="email" options={{ title: 'Change email' }} />
      <Stack.Screen name="password" options={{ title: 'Change password' }} />
    </Stack>
  );
}
