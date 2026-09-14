import { Stack } from 'expo-router/stack';

import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';

export default function ResponderHistoryLayout() {
  return <Stack screenOptions={useStackScreenOptions()}><Stack.Screen name="index" options={{ title: 'Scan activity' }} /><Stack.Screen name="[id]" options={{ title: 'Saved emergency scan' }} /><Stack.Screen name="[id]/note" options={{ title: 'Responder note', headerShown: false }} /><Stack.Screen name="[id]/encounter" options={{ title: 'Encounter report' }} /></Stack>;
}
