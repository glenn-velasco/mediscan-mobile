import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/primary-button';
import { EmptyState } from '@/components/empty-state';
import { QrCodeView } from '@/components/qr-code-view';
import { QrScannerView } from '@/components/qr-scanner-view';
import { ScannedEmergencyCard } from '@/components/scanned-emergency-card';
import { buildEmergencySummary } from '@/lib/build-emergency-summary';
import { encryptQrPayload } from '@/lib/qr-cipher';
import { parseEmergencySummary, type ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';
import { logEmergencyQrEvent } from '@/api/endpoints/analytics';
import { useAuth } from '@/auth/useAuth';
import { useMedicalInformation } from '@/features/medical-information/useMedicalInformation';
import { useAllergies } from '@/features/allergies/useAllergies';
import { useDiagnoses } from '@/features/diagnoses/useDiagnoses';
import { useEmergencyContacts } from '@/features/emergency-contacts';
import { useTheme } from '@/hooks/use-theme';

export type QrBottomSheetHandle = { present: () => void; dismiss: () => void };

type Mode = 'show' | 'scan';

function renderBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />;
}

export const QrBottomSheet = forwardRef<QrBottomSheetHandle>(function QrBottomSheet(_props, ref) {
  const sheetRef = useRef<BottomSheetModal>(null);
  const theme = useTheme();
  const [mode, setMode] = useState<Mode>('show');
  const [scanned, setScanned] = useState<ScannedEmergencyInfo | null>(null);
  const [scanError, setScanError] = useState(false);
  const [presentedAt, setPresentedAt] = useState(() => Date.now());
  const [summary, setSummary] = useState<string | null>(null);

  const { user } = useAuth();
  const isVerifiedProfessional = user?.permissions?.includes('verified professional') ?? false;
  const { data: medicalInformation } = useMedicalInformation();
  const { data: allergies = [] } = useAllergies();
  const { data: diagnoses = [] } = useDiagnoses();
  const { data: emergencyContacts = [] } = useEmergencyContacts();

  useEffect(() => {
    if (!user || !medicalInformation) {
      setSummary(null);
      return;
    }
    let cancelled = false;
    encryptQrPayload(buildEmergencySummary(user.id, new Date(presentedAt), medicalInformation, allergies, emergencyContacts, diagnoses)).then(
      (encrypted) => {
        if (!cancelled) setSummary(encrypted);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [user, medicalInformation, allergies, diagnoses, emergencyContacts, presentedAt]);

  useImperativeHandle(ref, () => ({
    present: () => {
      setMode('show');
      setScanned(null);
      setScanError(false);
      setPresentedAt(Date.now());
      if (user) logEmergencyQrEvent({ action: 'shown', patient_id: user.id }).catch(() => {});
      sheetRef.current?.present();
    },
    dismiss: () => sheetRef.current?.dismiss(),
  }));

  const handleScanned = useCallback((data: string) => {
    parseEmergencySummary(data).then((parsed) => {
      if (!parsed) {
        console.log('[QR Scan] Not a MediScan QR code');
        setScanError(true);
        return;
      }
      setScanned(parsed);
      console.log(`[QR Scan] Scanned patient ${parsed.patientId} – user is ${isVerifiedProfessional ? 'verified professional → full details shown' : 'not verified → personal details only'}`);
      if (parsed.patientId !== null) {
        logEmergencyQrEvent({ action: 'scanned', patient_id: parsed.patientId, context: 'viewer' }).catch(() => {});
      }
    });
  }, [isVerifiedProfessional]);

  const switchMode = useCallback((next: Mode) => {
    setMode(next);
    setScanned(null);
    setScanError(false);
  }, []);

  return (
    <BottomSheetModal
      ref={sheetRef}
      enableDynamicSizing
      backgroundStyle={{ backgroundColor: theme.background, borderRadius: 20 }}
      handleIndicatorStyle={{ backgroundColor: theme.border, width: 36 }}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetView className="gap-4 px-6 pb-10 pt-2">
        <View className="flex-row gap-3">
          <Pressable
            onPress={() => switchMode('show')}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3"
            style={{ backgroundColor: mode === 'show' ? theme.primary : theme.muted }}
          >
            <Ionicons name="qr-code" size={18} color={mode === 'show' ? theme.primaryForeground : theme.foreground} />
            <ThemedText style={{ fontWeight: '600', color: mode === 'show' ? theme.primaryForeground : theme.foreground }}>My QR</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => switchMode('scan')}
            className="flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3"
            style={{ backgroundColor: mode === 'scan' ? theme.primary : theme.muted }}
          >
            <Ionicons name="camera" size={18} color={mode === 'scan' ? theme.primaryForeground : theme.foreground} />
            <ThemedText style={{ fontWeight: '600', color: mode === 'scan' ? theme.primaryForeground : theme.foreground }}>Scan</ThemedText>
          </Pressable>
        </View>

        {mode === 'show' ? (
          <View className="items-center gap-4">
            {summary ? (
              <View className="rounded-2xl p-5" style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }}>
                <QrCodeView value={summary} />
              </View>
            ) : (
              <EmptyState
                title="No medical profile yet"
                body="Add your medical information first so it can be shared in an emergency."
              />
            )}
          </View>
        ) : scanned ? (
          <ScannedEmergencyCard info={scanned} showMedicalDetails={isVerifiedProfessional} onScanAnother={() => switchMode('scan')} />
        ) : scanError ? (
          <View className="items-center gap-4 py-8">
            <ThemedText style={{ textAlign: 'center', color: theme.mutedForeground }}>
              That doesn&apos;t look like a MediScan QR code.
            </ThemedText>
            <PrimaryButton label="Try again" onPress={() => setScanError(false)} />
          </View>
        ) : (
          <QrScannerView onScanned={handleScanned} />
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
});
