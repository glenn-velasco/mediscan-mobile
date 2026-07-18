import '@/global.css';
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '@/auth/AuthContext';
import { useAuth } from '@/auth/useAuth';
import { getDb } from '@/db/client';
import { useAppUpdates } from '@/hooks/use-app-updates';
import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';
import { queryClient, queryPersister } from '@/lib/query-client';
import { OnboardingProvider } from '@/onboarding/OnboardingContext';
import { PermissionsPrimerProvider } from '@/onboarding/PermissionsPrimerContext';
import { useOnboarding } from '@/onboarding/useOnboarding';
import { usePermissionsPrimer } from '@/onboarding/usePermissionsPrimer';
import { usePrimePermissions } from '@/onboarding/usePrimePermissions';
import { BroadcastProvider } from '@/realtime/BroadcastProvider';
import { ensureDeviceKeyRegistered } from '@/services/device-key.service';
import { useSyncTriggers } from '@/sync/triggers';

function RootNavigator() {
  const { status } = useAuth();
  const { seen } = useOnboarding();
  const { primed } = usePermissionsPrimer();
  usePrimePermissions(seen === true && primed === false);
  const screenOptions = useStackScreenOptions();
  const [dbReady, setDbReady] = useState(false);
  useSyncTriggers();
  useAppUpdates();

  const [fontsLoaded] = useFonts({
    'PlusJakartaSans-Regular': require('../../assets/fonts/PlusJakartaSans-Regular.ttf'),
    'PlusJakartaSans-Medium': require('../../assets/fonts/PlusJakartaSans-Medium.ttf'),
    'PlusJakartaSans-SemiBold': require('../../assets/fonts/PlusJakartaSans-SemiBold.ttf'),
    'PlusJakartaSans-Bold': require('../../assets/fonts/PlusJakartaSans-Bold.ttf'),
    'Inter-Regular': require('../../assets/fonts/Inter-Regular.ttf'),
    'Inter-Medium': require('../../assets/fonts/Inter-Medium.ttf'),
    'Inter-SemiBold': require('../../assets/fonts/Inter-SemiBold.ttf'),
    'Inter-Bold': require('../../assets/fonts/Inter-Bold.ttf'),
  });

  useEffect(() => {
    getDb().then(
      () => setDbReady(true),
      () => setDbReady(true),
    );
  }, []);

  const ready = fontsLoaded && status !== 'idle' && seen !== null && primed !== null && dbReady;
  const authenticated = status === 'authenticated';

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  useEffect(() => {
    if (status === 'authenticated') {
      void ensureDeviceKeyRegistered();
    }
  }, [status]);

  return (
    <Stack screenOptions={{ ...screenOptions, headerShown: false }}>
      <Stack.Protected guard={ready && seen === false}>
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={ready && seen === true && authenticated}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="allergies" />
        <Stack.Screen name="diagnoses" />
        <Stack.Screen name="medications" />
        <Stack.Screen name="emergency-contacts" />
        <Stack.Screen name="account" />
        <Stack.Screen name="sync-status" options={{ headerShown: true, title: 'Sync status', presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={ready && seen === true && !authenticated}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    try {
      void SplashScreen.preventAutoHideAsync();
    } catch {
      console.warn('Failed to prevent splash auto-hide');
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister }}>
        <OnboardingProvider>
          <PermissionsPrimerProvider>
            <AuthProvider>
              <BroadcastProvider>
                <BottomSheetModalProvider>
                  <StatusBar style="auto" />
                  <RootNavigator />
                </BottomSheetModalProvider>
              </BroadcastProvider>
            </AuthProvider>
          </PermissionsPrimerProvider>
        </OnboardingProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
