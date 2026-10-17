import '@/lib/worklets-guard';
import '@/global.css';
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { AvoidSoftInput } from 'react-native-avoid-softinput';
import { SystemBars } from 'react-native-edge-to-edge';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AuthProvider } from '@/auth/AuthContext';
import { useAuth } from '@/auth/useAuth';
import { ErrorBoundary } from '@/components/error-boundary';
import { NetworkProvider } from '@/hooks/use-network-status';

import { useBleAdvertisingResume } from '@/features/ble-sync/useBleAdvertisingResume';
import { usePendingAvatarUpload } from '@/features/medical-information/useMedicalInformationAvatar';
import { useAppUpdates } from '@/hooks/use-app-updates';
import { useTheme } from '@/hooks/use-theme';
import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';
import { setAppReady } from '@/lib/app-ready';
import { addQuickScanRouteListener, getPendingQuickScanRoute } from '@/lib/qr-scanner-tile-native';
import { queryClient, queryPersister } from '@/lib/query-client';
import { BootProvider } from '@/onboarding/BootProvider';
import { useOnboarding } from '@/onboarding/useOnboarding';
import { usePermissionsPrimer } from '@/onboarding/usePermissionsPrimer';
import { usePrimePermissions } from '@/onboarding/usePrimePermissions';
import { BroadcastProvider } from '@/realtime/BroadcastProvider';
import { useSyncTriggers } from '@/sync/triggers';

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

void SplashScreen.preventAutoHideAsync().catch(() => {});

/** Mounts after splash hides — runs sync triggers, OTA update check, etc. */
function DeferredWork() {
  useSyncTriggers();
  useAppUpdates();
  usePendingAvatarUpload();
  useBleAdvertisingResume();
  return null;
}

function RootNavigator() {
  const { status } = useAuth();
  const { seen } = useOnboarding();
  const { primed } = usePermissionsPrimer();
  usePrimePermissions(seen === true && primed === false);
  const screenOptions = useStackScreenOptions();
  const [showDeferred, setShowDeferred] = useState(false);
  const [bootTimeout, setBootTimeout] = useState(false);
  const onReadyCalledRef = useRef(false);

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

  // Safety timeout — if boot takes more than 10s, force-show the app
  useEffect(() => {
    const timer = setTimeout(() => setBootTimeout(true), 10_000);
    return () => clearTimeout(timer);
  }, []);

  const authenticated = status === 'authenticated';

  const ready = bootTimeout || (fontsLoaded && status !== 'idle' && seen !== null && primed !== null);

  useEffect(() => {
    if (ready && !onReadyCalledRef.current) {
      onReadyCalledRef.current = true;
      console.log('[Splash] hiding splash screen');
      void SplashScreen.hideAsync();
      requestAnimationFrame(() => {
        setShowDeferred(true);
        setAppReady(true);
      });
    }
  }, [ready]);

  useEffect(() => {
    if (status === 'authenticated') {
      // Lazy-import to avoid triggering Metro module bundling during initial render,
      // which causes a module graph re-evaluation and double-init of BroadcastProvider.
      // react-doctor-disable-next-line react-hooks-js/todo
      import('@/services/device-key.service').then(({ ensureDeviceKeyRegistered }) => {
        void ensureDeviceKeyRegistered();
      });
    }
  }, [status]);

  useEffect(() => {
    return addQuickScanRouteListener((route) => {
      if (route === 'quick-scan') router.replace('/quick-scan');
    });
  }, []);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    void getPendingQuickScanRoute().then((route) => {
      if (active && route === 'quick-scan') router.replace('/quick-scan');
    });
    return () => {
      active = false;
    };
  }, [ready]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const href = response.notification.request.content.data?.href;
      if (typeof href === 'string') router.push(href as never);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (ready) {
      console.log('[Stack]', { ready, seen, authenticated, onboardingGuard: seen !== true, appGuard: seen === true && authenticated, authGuard: seen === true && !authenticated });
    }
  }, [ready, seen, authenticated]);

  return (
    <>
      {showDeferred && <DeferredWork />}
      <Stack screenOptions={{ ...screenOptions, headerShown: false }}>
        <Stack.Protected guard={ready && seen !== true}>
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
          <Stack.Screen name="emergency-wallet-card" options={{ headerShown: true, title: 'Wallet card' }} />
          <Stack.Screen name="professional-application" />
          <Stack.Screen name="admin-verification" />
          <Stack.Screen name="encounters" />
          <Stack.Screen name="professional-scans" />
          <Stack.Screen name="manage-info" options={{ headerShown: true, title: 'Manage info', presentation: 'modal' }} />
          <Stack.Screen name="registration-match" />
          <Stack.Screen name="account-retrieval" />
          <Stack.Screen name="sync-status" options={{ headerShown: true, title: 'Sync status', presentation: 'modal' }} />
          <Stack.Screen name="onboarding-tasks" options={{ headerShown: false, presentation: 'modal', gestureEnabled: false }} />
        </Stack.Protected>
        <Stack.Protected guard={ready && seen === true && !authenticated}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="registration-pending" />
        </Stack.Protected>
        <Stack.Protected guard={ready}>
          <Stack.Screen name="quick-scan" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="responder-scan" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
          <Stack.Screen name="responder-history" />
          {/* Supabase Auth callback targets are accessible regardless of auth state. */}
          <Stack.Screen name="email-verified" />
          <Stack.Screen name="auth/callback" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const theme = useTheme();

  useEffect(() => {
    AvoidSoftInput.setEnabled(true);
    void import('@/db/repositories/recent-emergency-scans.repo').then(({ purgeExpired }) => purgeExpired());
    return () => AvoidSoftInput.setEnabled(false);
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.background }}>
        <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: queryPersister }}>
          <BootProvider>
            <AuthProvider>
              <NetworkProvider>
                <BroadcastProvider>
                  <BottomSheetModalProvider>
                    <SystemBars style="auto" hidden={{ navigationBar: true }} />
                    <RootNavigator />
                  </BottomSheetModalProvider>
                </BroadcastProvider>
              </NetworkProvider>
            </AuthProvider>
          </BootProvider>
        </PersistQueryClientProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
