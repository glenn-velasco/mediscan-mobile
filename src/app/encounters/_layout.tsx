import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';
export default function EncounterLayout() { const options = useStackScreenOptions(); return <Stack screenOptions={options}><Stack.Screen name="index" options={{ title: 'Encounter reports' }} /></Stack>; }
