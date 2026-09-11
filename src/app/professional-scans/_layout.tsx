import { Stack } from 'expo-router';

import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';

export default function ProfessionalScansStackLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'Scanned Patients' }} />
      <Stack.Screen name="[patientId]" options={{ title: 'Patient Detail' }} />
    </Stack>
  );
}
