import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { logEmergencyQrEvent } from '@/api/endpoints/analytics';
import { useAuth } from '@/auth/useAuth';
import { EmptyState } from '@/components/empty-state';
import { ManageInfoBottomSheet, type ManageInfoBottomSheetHandle } from '@/components/manage-info-bottom-sheet';
import { PrimaryButton } from '@/components/primary-button';
import { QrCodeView } from '@/components/qr-code-view';
import { QrScannerView } from '@/components/qr-scanner-view';
import { ScannedEmergencyCard } from '@/components/scanned-emergency-card';
import { ThemedText } from '@/components/themed-text';
import { useAllergies } from '@/features/allergies/useAllergies';
import { useConditions } from '@/features/conditions/useConditions';
import { useDiagnoses } from '@/features/diagnoses/useDiagnoses';
import { useEmergencyContacts } from '@/features/emergency-contacts';
import { useMedicalInformation } from '@/features/medical-information/useMedicalInformation';
import { useMedications } from '@/features/medications/useMedications';
import { useTheme } from '@/hooks/use-theme';
import { buildEmergencySummary } from '@/lib/build-emergency-summary';
import { useLightweightMode } from '@/lib/lightweight-mode-context';
import { parseEmergencySummary, type ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';
import { encryptQrPayload } from '@/lib/qr-cipher';
import { clearQuickScanLockScreenFlags } from '@/lib/qr-scanner-tile-native';
import { useBiometricAuth } from '@/lib/use-biometric-auth';

type Mode = 'show' | 'scan';

/**
 * Landing screen for the Android Quick Settings tile (see plugins/withQrScannerTile.js). Reachable
 * over the lock screen without unlocking so scanning/showing can start immediately. Opens on the
 * user's own emergency QR (no auth needed to show your own code — same exposure as the existing
 * home-screen widget); switching to scan mode still holds decoded medical data behind a biometric/
 * passcode challenge before it's shown, per the approved plan.
 */
export default function QuickScanScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { status: authStatus, user } = useAuth();
  const biometric = useBiometricAuth();
  const { isLightweight, promoteToFullApp } = useLightweightMode();
  const manageInfoSheetRef = useRef<ManageInfoBottomSheetHandle>(null);
  const isVerifiedProfessional = user?.permissions?.includes('verified professional') ?? false;

  const [mode, setMode] = useState<Mode>('show');
  const [summary, setSummary] = useState<string | null>(null);
  const [scanned, setScanned] = useState<ScannedEmergencyInfo | null>(null);
  const [scannedRaw, setScannedRaw] = useState<string | null>(null);
  const [scanError, setScanError] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const loggedRef = useRef(false);

  const { data: medicalInformation } = useMedicalInformation();
  const { data: allergies = [] } = useAllergies();
  const { data: conditions = [] } = useConditions();
  const { data: diagnoses = [] } = useDiagnoses();
  const { data: medications = [] } = useMedications();
  const { data: emergencyContacts = [] } = useEmergencyContacts();

  useEffect(() => {
    return () => clearQuickScanLockScreenFlags();
  }, []);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      promoteToFullApp().then(() => router.replace('/(auth)'));
    }
  }, [authStatus, promoteToFullApp]);

  useEffect(() => {
    if (!user || !medicalInformation) return;
    let cancelled = false;
    encryptQrPayload(buildEmergencySummary(user.id, new Date(), medicalInformation, allergies, emergencyContacts, diagnoses, medications, conditions)).then(
      (encrypted) => {
        if (!cancelled) setSummary(encrypted);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [user, medicalInformation, allergies, conditions, diagnoses, medications, emergencyContacts]);

  const displaySummary = user && medicalInformation ? summary : null;

  const handleScanned = useCallback((data: string) => {
    parseEmergencySummary(data).then((parsed) => {
      if (!parsed) {
        setScanError(true);
        return;
      }
      setScanned(parsed);
      setScannedRaw(data);
    });
  }, []);

  useEffect(() => {
    if (scanned && biometric.status === 'idle') {
      void biometric.authenticate();
    }
  }, [scanned, biometric]);

  useEffect(() => {
    if (biometric.status === 'authenticated' && scanned?.patientId !== null && scanned && !loggedRef.current) {
      loggedRef.current = true;
      const context = isLightweight ? 'quick_scan_tile' : 'viewer';
      logEmergencyQrEvent({ action: 'scanned', patient_id: scanned.patientId as number, context }).catch(() => {});
    }
  }, [biometric.status, scanned, isLightweight]);

  const handleManageInfo = useCallback(() => {
    if (!scanned || scanned.patientId === null) return;
    logEmergencyQrEvent({ action: 'scanned', patient_id: scanned.patientId, context: 'professional_submit' }).catch(() => {});
    manageInfoSheetRef.current?.present(scanned.patientId, scannedRaw ?? '');
  }, [scanned, scannedRaw]);

  const handleClose = useCallback(() => {
    clearQuickScanLockScreenFlags();
    if (navigation.canGoBack()) {
      router.back();
    } else {
      setPromoting(true);
      promoteToFullApp().then(() => router.replace('/(app)'));
    }
  }, [navigation, promoteToFullApp]);

  const resetScan = useCallback(() => {
    setScanned(null);
    setScannedRaw(null);
    setScanError(false);
    loggedRef.current = false;
    biometric.reset();
  }, [biometric]);

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setScanned(null);
    setScannedRaw(null);
    setScanError(false);
    setTorchOn(false);
    loggedRef.current = false;
    biometric.reset();
  }, [biometric]);

  if (promoting || authStatus === 'idle' || authStatus === 'authenticating' || authStatus === 'unauthenticated') {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: theme.background }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (authStatus !== 'authenticated' || !user) {
    return null;
  }

  const showingCamera = mode === 'scan' && !scanned && !scanError;

  const closeButton = (
    <Pressable
      onPress={handleClose}
      hitSlop={12}
      className="h-9 w-9 items-center justify-center rounded-full"
      style={{ backgroundColor: showingCamera ? 'rgba(0,0,0,0.4)' : theme.muted }}
    >
      <Ionicons name="close" size={20} color={showingCamera ? '#fff' : theme.foreground} />
    </Pressable>
  );

  if (showingCamera) {
    return (
      <>
        <View className="flex-1 bg-black">
          <QrScannerView onScanned={handleScanned} fullscreen torchOn={torchOn} accentColor={theme.primary} />
          <View className="absolute left-0 right-0 flex-row items-center justify-between px-4" style={{ top: insets.top + 8 }}>
            <Pressable
              onPress={() => switchMode('show')}
              hitSlop={12}
              className="h-9 w-9 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            >
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </Pressable>
            <View className="flex-row items-center" style={{ gap: 10 }}>
              <Pressable
                onPress={() => setTorchOn((prev) => !prev)}
                hitSlop={12}
                className="h-9 w-9 items-center justify-center rounded-full"
                style={{ backgroundColor: torchOn ? '#ffffff' : 'rgba(0,0,0,0.4)' }}
              >
                <Ionicons name={torchOn ? 'flash' : 'flash-outline'} size={18} color={torchOn ? '#000' : '#fff'} />
              </Pressable>
              {closeButton}
            </View>
          </View>
        </View>
        <ManageInfoBottomSheet ref={manageInfoSheetRef} />
      </>
    );
  }

  return (
    <>
      <View className="flex-1" style={{ backgroundColor: theme.background }}>
        <ScrollView
          className="flex-1 px-6 pt-16"
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="mb-4 items-end">{closeButton}</View>

          {mode === 'show' ? (
            <View className="items-center gap-4">
              {displaySummary ? (
                <>
                  <View className="rounded-2xl p-6" style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}>
                    <QrCodeView value={displaySummary} size={280} />
                  </View>
                  <Pressable
                    onPress={() => switchMode('scan')}
                    className="flex-row items-center justify-center gap-2 rounded-xl px-6 py-3"
                    style={{ backgroundColor: theme.muted }}
                  >
                    <Ionicons name="camera" size={18} color={theme.foreground} />
                    <ThemedText style={{ fontWeight: '600' }}>Scan</ThemedText>
                  </Pressable>
                </>
              ) : (
                <EmptyState
                  title="No medical profile yet"
                  body="Add your medical information first so it can be shared in an emergency."
                />
              )}
            </View>
          ) : scanError ? (
            <View className="items-center gap-4 py-8">
              <ThemedText style={{ textAlign: 'center', color: theme.mutedForeground }}>
                That doesn&apos;t look like a MediScan QR code.
              </ThemedText>
              <PrimaryButton label="Try again" onPress={() => setScanError(false)} />
            </View>
          ) : biometric.status === 'authenticated' && scanned ? (
            <View className="gap-4">
              {isVerifiedProfessional && scanned.patientId !== null ? (
                <Pressable
                  onPress={handleManageInfo}
                  className="flex-row items-center gap-3 rounded-xl px-4 py-3.5"
                  style={{ backgroundColor: theme.primary + '15', borderWidth: 1, borderColor: theme.primary + '30' }}
                >
                  <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.primary + '20' }}>
                    <Ionicons name="medkit" size={18} color={theme.primary} />
                  </View>
                  <View className="flex-1">
                    <ThemedText style={{ fontWeight: '600', color: theme.primary }}>Manage info</ThemedText>
                    <ThemedText type="small" color="mutedForeground">
                      Verify allergies, witness consent, or leave a note as a professional.
                    </ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.primary} />
                </Pressable>
              ) : null}
              <ScannedEmergencyCard info={scanned} onScanAnother={resetScan} showMedicalDetails />
            </View>
          ) : (
            <View className="items-center gap-4 py-8">
              <Ionicons name="lock-closed" size={32} color={theme.mutedForeground} />
              <ThemedText type="heading" className="text-center">
                Authenticate to view
              </ThemedText>
              <ThemedText style={{ textAlign: 'center', color: theme.mutedForeground }}>
                {biometric.status === 'unavailable'
                  ? 'No biometrics or passcode set up on this device, so scanned info can’t be shown here.'
                  : biometric.status === 'failed'
                    ? 'Authentication failed or was cancelled.'
                    : 'Waiting for authentication…'}
              </ThemedText>
              {biometric.status === 'failed' ? <PrimaryButton label="Try again" onPress={() => void biometric.authenticate()} /> : null}
              <PrimaryButton label="Cancel" variant="ghost" onPress={() => switchMode('show')} />
            </View>
          )}
        </ScrollView>
      </View>
      <ManageInfoBottomSheet ref={manageInfoSheetRef} />
    </>
  );
}
