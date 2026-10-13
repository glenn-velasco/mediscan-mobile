import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/auth/useAuth';
import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';

export default function ProfessionalScansStackLayout() {
  const screenOptions = useStackScreenOptions();
  const { status, user } = useAuth();

  if (status === 'authenticated' && !user?.permissions.includes('verified professional')) {
    return <Redirect href="/(app)" />;
  }

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'Scanned Patients' }} />
      <Stack.Screen name="[patientId]" options={{ title: 'Patient Detail' }} />
    </Stack>
  );
}
