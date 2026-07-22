import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';

export default function RegistrationMatchLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="[id]" options={{ title: 'Verification needed' }} />
    </Stack>
  );
}
