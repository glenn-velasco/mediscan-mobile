import '@/global.css';
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';

import { AuthProvider } from '@/auth/AuthContext';
import { useAuth } from '@/auth/useAuth';
import { queryClient, queryPersister } from '@/lib/query-client';
import { useSyncTriggers } from '@/sync/triggers';
import { ensureDeviceKeyRegistered } from '@/services/device-key.service';
import { BroadcastProvider } from '@/realtime/BroadcastProvider';
import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';
import { OnboardingProvider } from '@/onboarding/OnboardingContext';
import { useOnboarding } from '@/onboarding/useOnboarding';
import { getDb } from '@/db/client';

function RootNavigator() {
  const { status } = useAuth();
  const { seen } = useOnboarding();
  const screenOptions = useStackScreenOptions();
  const [dbReady, setDbReady] = useState(false);
  useSyncTriggers();

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

  const ready = fontsLoaded && status !== 'idle' && seen !== null && dbReady;
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
        <Stack.Screen name="emergency-contacts" />
        <Stack.Screen name="account" />
        <Stack.Screen name="professional" options={{ headerShown: true }} />
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
          <AuthProvider>
            <BroadcastProvider>
              <BottomSheetModalProvider>
                <StatusBar style="auto" />
                <RootNavigator />
              </BottomSheetModalProvider>
            </BroadcastProvider>
          </AuthProvider>
        </OnboardingProvider>
      </PersistQueryClientProvider>
    </GestureHandlerRootView>
  );
}
