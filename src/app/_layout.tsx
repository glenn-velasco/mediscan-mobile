import '@/global.css';
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AvoidSoftInput } from 'react-native-avoid-softinput';
import { SystemBars } from 'react-native-edge-to-edge';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '@/auth/AuthContext';
import { useAuth } from '@/auth/useAuth';
import { getDb } from '@/db/client';
import { useAppUpdates } from '@/hooks/use-app-updates';
import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';
import { LightweightModeContext } from '@/lib/lightweight-mode-context';
import { addQuickScanRouteListener, getPendingQuickScanRoute } from '@/lib/qr-scanner-tile-native';
import { queryClient, queryPersister } from '@/lib/query-client';
import { BootProvider } from '@/onboarding/BootProvider';
import { useOnboarding } from '@/onboarding/useOnboarding';
import { usePermissionsPrimer } from '@/onboarding/usePermissionsPrimer';
import { usePrimePermissions } from '@/onboarding/usePrimePermissions';
import { BroadcastProvider } from '@/realtime/BroadcastProvider';
import { ensureDeviceKeyRegistered } from '@/services/device-key.service';
import { useSyncTriggers } from '@/sync/triggers';

type BootMode = 'pending' | 'lightweight' | 'full';

// Without this, a local notification fired while the app is foregrounded (see
// showLocalNotification in src/lib/notifications.ts) is silently swallowed on some
// platforms instead of showing a banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Mounts after splash hides — runs sync triggers, OTA update check, etc. */
function DeferredWork() {
  useSyncTriggers();
  useAppUpdates();
  return null;
}

function RootNavigator({ onReady }: { onReady: () => void }) {
  const { status } = useAuth();
  const { seen } = useOnboarding();
  const { primed } = usePermissionsPrimer();
  usePrimePermissions(seen === true && primed === false);
  const screenOptions = useStackScreenOptions();
  const [dbReady, setDbReady] = useState(false);
  const [showDeferred, setShowDeferred] = useState(false);

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

  const authenticated = status === 'authenticated';

  const ready = fontsLoaded && status !== 'idle' && seen !== null && primed !== null && dbReady;

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
      onReady();
      requestAnimationFrame(() => setShowDeferred(true));
    }
  }, [ready, onReady]);

  useEffect(() => {
    if (status === 'authenticated') {
      void ensureDeviceKeyRegistered();
    }
  }, [status]);

  useEffect(() => {
    return addQuickScanRouteListener((route) => {
      if (route === 'quick-scan') router.replace('/quick-scan');
    });
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const href = response.notification.request.content.data?.href;
      if (typeof href === 'string') router.push(href as never);
    });
    return () => sub.remove();
  }, []);

  return (
    <>
      {showDeferred && <DeferredWork />}
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
        <Stack.Screen name="conditions" />
        <Stack.Screen name="account" />
        <Stack.Screen name="professional-application" />
        <Stack.Screen name="registration-match" />
        <Stack.Screen name="sync-status" options={{ headerShown: true, title: 'Sync status', presentation: 'modal' }} />
        <Stack.Screen name="onboarding-tasks" options={{ headerShown: false, presentation: 'modal', gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={ready && seen === true && !authenticated}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="registration-pending" />
      </Stack.Protected>
      <Stack.Protected guard={ready}>
        <Stack.Screen name="quick-scan" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      </Stack.Protected>
      </Stack>
    </>
  );
}

/**
 * Minimal tree for a cold start from the QR quick-scan tile: skips Onboarding/PermissionsPrimer/
 * Broadcast providers, sync triggers, app-update checks, custom font loading, and the persisted
 * (AsyncStorage-hydrated) query cache — none of which quick-scan.tsx needs. Shares the same
 * `queryClient` instance as the full tree so nothing fetched here is wasted if promoted.
 */
function LightweightQuickScan() {
  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider skipNetworkRefresh>
          <BottomSheetModalProvider>
            <SystemBars style="auto" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="quick-scan" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
            </Stack>
          </BottomSheetModalProvider>
        </AuthProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const [mode, setMode] = useState<BootMode>('pending');
  const promoteResolversRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    AvoidSoftInput.setEnabled(true);
    return () => AvoidSoftInput.setEnabled(false);
  }, []);

  useEffect(() => {
    try {
      void SplashScreen.preventAutoHideAsync();
    } catch {
      console.warn('Failed to prevent splash auto-hide');
    }
  }, []);

  useEffect(() => {
    getPendingQuickScanRoute().then((route) => {
      setMode(route === 'quick-scan' ? 'lightweight' : 'full');
    });
  }, []);

  const promoteToFullApp = useCallback(() => {
    if (mode === 'full') return Promise.resolve();
    setMode('full');
    return new Promise<void>((resolve) => {
      promoteResolversRef.current.push(resolve);
    });
  }, [mode]);

  const handleFullTreeReady = useCallback(() => {
    const resolvers = promoteResolversRef.current;
    promoteResolversRef.current = [];
    resolvers.forEach((resolve) => resolve());
  }, []);

  if (mode === 'pending') return null;

  return (
    <LightweightModeContext.Provider value={{ isLightweight: mode === 'lightweight', promoteToFullApp }}>
      {mode === 'lightweight' ? (
        <LightweightQuickScan />
      ) : (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister }}>
            <BootProvider>
              <AuthProvider>
                <BroadcastProvider>
                  <BottomSheetModalProvider>
                    <SystemBars style="auto" />
                    <RootNavigator onReady={handleFullTreeReady} />
                  </BottomSheetModalProvider>
                </BroadcastProvider>
              </AuthProvider>
            </BootProvider>
          </PersistQueryClientProvider>
        </GestureHandlerRootView>
      )}
    </LightweightModeContext.Provider>
  );
}
