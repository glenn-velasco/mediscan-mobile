import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';

export default function EmergencyContactsLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'Emergency contacts' }} />
      <Stack.Screen name="new" options={{ title: 'Add contact', presentation: 'modal' }} />
      <Stack.Screen name="[localUuid]" options={{ title: 'Edit contact', presentation: 'modal' }} />
    </Stack>
  );
}
