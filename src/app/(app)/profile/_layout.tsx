import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';

export default function ProfileStackLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="edit" options={{ title: 'Edit profile' }} />
      <Stack.Screen name="avatar" options={{ title: 'Update photo' }} />
    </Stack>
  );
}
