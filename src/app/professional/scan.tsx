import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { AppLayout } from '@/components/layouts/app-layout';
import { Card } from '@/components/card';
import { QrScannerView } from '@/components/qr-scanner-view';
import { PrimaryButton } from '@/components/primary-button';
import { parseEmergencySummary, type ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';
import { logEmergencyQrEvent } from '@/api/endpoints/analytics';

type ScanResult = { patientId: number; qrData: string; info: ScannedEmergencyInfo };

export default function ProfessionalScanScreen() {
  const router = useRouter();
  const [scanError, setScanError] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);

  const handleScanned = useCallback(
    (data: string) => {
      parseEmergencySummary(data).then((parsed) => {
        if (!parsed || parsed.patientId === null) {
          setScanError(true);
          return;
        }
        logEmergencyQrEvent({ action: 'scanned', patient_id: parsed.patientId, context: 'professional_submit' }).catch(() => {});
        setResult({ patientId: parsed.patientId, qrData: data, info: parsed });
      });
    },
    [],
  );

  useEffect(() => {
    if (result) {
      router.replace({
        pathname: '/professional/manage/[patientId]',
        params: { patientId: String(result.patientId), qrData: result.qrData },
      });
    }
  }, [result, router]);

  return (
    <AppLayout>
      <ThemedText type="small" color="mutedForeground" className="mb-4 text-center">
        Ask the patient to open their account screen and show their QR code.
      </ThemedText>

      {scanError ? (
        <View className="items-center gap-4 py-8">
          <ThemedText color="mutedForeground" className="text-center">
            That doesn&apos;t look like a MediScan QR code.
          </ThemedText>
          <PrimaryButton label="Try again" onPress={() => setScanError(false)} />
        </View>
      ) : (
        <QrScannerView onScanned={handleScanned} />
      )}
    </AppLayout>
  );
}
