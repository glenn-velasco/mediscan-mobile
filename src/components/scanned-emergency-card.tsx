import { View } from 'react-native';

import { Card } from '@/components/card';
import { InfoRow } from '@/components/info-row';
import { PrimaryButton } from '@/components/primary-button';
import { SeverityBadge } from '@/components/severity-badge';
import { ThemedText } from '@/components/themed-text';
import type { AllergyRow } from '@/db/schema';
import type { ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';

/** Displays another person's scanned emergency QR contents — read-only, never written to the local database. */
export function ScannedEmergencyCard({
  info,
  onScanAnother,
  showMedicalDetails = true,
}: {
  info: ScannedEmergencyInfo;
  onScanAnother: () => void;
  showMedicalDetails?: boolean;
}) {
  console.log(`[QR Scan Card] showMedicalDetails=${showMedicalDetails} – ${showMedicalDetails ? 'rendering emergency contacts + allergies' : 'personal details only'}`);
  return (
    <View className="gap-4">
      <ThemedText className="text-center text-lg font-semibold">{info.name || 'Unknown'}</ThemedText>

      <Card className="p-0">
        <View className="px-4">
          <InfoRow label="Generated" value={info.generatedAt || '—'} />
          <InfoRow label="Date of birth" value={info.dateOfBirth || '—'} />
          <InfoRow label="Gender" value={info.gender || '—'} />
          <InfoRow label="No blood transfusion" value={info.noBloodTransfusion || '—'} />
          <InfoRow label="Phone" value={info.phone || '—'} />
          <InfoRow label="Address" value={info.address || '—'} last />
        </View>
      </Card>

      {showMedicalDetails && info.emergencyContacts.length > 0 && (
        <Card className="p-0">
          <View className="px-4">
            <InfoRow label="Emergency contacts" value={`${info.emergencyContacts.length}`} />
            {info.emergencyContacts.map((contact, i) => (
              <View key={i}>
                <InfoRow label="Name" value={contact.name} />
                {contact.relationship && <InfoRow label="Relationship" value={contact.relationship} />}
                {contact.phone && <InfoRow label="Phone" value={contact.phone} />}
                {i < info.emergencyContacts.length - 1 && <View className="border-b border-border" />}
              </View>
            ))}
          </View>
        </Card>
      )}

      {showMedicalDetails && (
        <View className="gap-2">
          <ThemedText type="smallBold" color="mutedForeground">
            Allergies
          </ThemedText>
          {info.allergies.length === 0 ? (
            <ThemedText color="mutedForeground">None recorded.</ThemedText>
          ) : (
            <Card>
              {info.allergies.map((allergy, i) => (
                <View
                  key={`${allergy.allergen}-${i}`}
                  className={i < info.allergies.length - 1 ? 'flex-row items-center justify-between border-b border-border py-3' : 'flex-row items-center justify-between py-3'}
                >
                  <ThemedText className="shrink">{allergy.allergen}</ThemedText>
                  <SeverityBadge severity={allergy.severity as AllergyRow['severity']} />
                </View>
              ))}
            </Card>
          )}
        </View>
      )}

      {showMedicalDetails && (
        <View className="gap-2">
          <ThemedText type="smallBold" color="mutedForeground">
            Medications
          </ThemedText>
          {info.medications.length === 0 ? (
            <ThemedText color="mutedForeground">None recorded.</ThemedText>
          ) : (
            <Card>
              {info.medications.map((medication, i) => (
                <View
                  key={`${medication.name}-${i}`}
                  className={i < info.medications.length - 1 ? 'border-b border-border py-3' : 'py-3'}
                >
                  <ThemedText className="shrink font-semibold">{medication.name}</ThemedText>
                  {medication.dosage || medication.frequency ? (
                    <ThemedText type="small" color="mutedForeground">
                      {[medication.dosage, medication.frequency].filter(Boolean).join(' · ')}
                    </ThemedText>
                  ) : null}
                </View>
              ))}
            </Card>
          )}
        </View>
      )}

      <PrimaryButton label="Scan another" variant="ghost" onPress={onScanAnother} />
    </View>
  );
}
