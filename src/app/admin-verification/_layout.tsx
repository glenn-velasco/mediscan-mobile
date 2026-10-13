import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';

export default function AdminVerificationLayout() {
  return <Stack screenOptions={useStackScreenOptions()}><Stack.Screen name="index" options={{ title: 'Verification queue' }} /><Stack.Screen name="[id]" options={{ title: 'Review application' }} /><Stack.Screen name="invite" options={{ title: 'Invite admin' }} /></Stack>;
}
