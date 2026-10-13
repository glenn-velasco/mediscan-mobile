import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { PatientHandoffShare } from '@/components/patient-handoff-share';
import { ScannedEmergencyCard } from '@/components/scanned-emergency-card';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import type { ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';
import type { QrVerificationResult } from '@/types/emergency';

export function EmergencyScanContent({
  info,
  verification,
  source,
  encounterExists,
  encounterReady,
  onRecordEncounter,
  onDeleteSavedScan,
  savedSnapshot = false,
  scanId,
}: {
  info: ScannedEmergencyInfo;
  verification: QrVerificationResult;
  source?: 'qr' | 'dynamic-card' | 'printable-offline';
  encounterExists?: boolean;
  encounterReady?: boolean;
  onRecordEncounter?: () => void;
  onDeleteSavedScan?: () => void;
  savedSnapshot?: boolean;
  scanId?: string;
}) {
  return (
    <View className="gap-4">
      {savedSnapshot ? <Card><ThemedText selectable color="mutedForeground">Saved scan — may not reflect the patient&apos;s current QR.</ThemedText></Card> : null}
      <ScannedEmergencyCard info={info} verification={verification} source={source} showMedicalDetails encounterExists={encounterExists} encounterReady={encounterReady} onRecordEncounter={onRecordEncounter} />
      <PatientHandoffShare info={info} scanId={scanId} />
      {onDeleteSavedScan ? (
        <PrimaryButton
          label="Delete saved scan"
          variant="danger"
          leftIcon={<Ionicons name="trash-outline" size={18} color="#fff" />}
          onPress={onDeleteSavedScan}
        />
      ) : null}
    </View>
  );
}
