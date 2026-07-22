import { View } from 'react-native';

import { Card } from '@/components/card';
import { InfoRow } from '@/components/info-row';
import { PrimaryButton } from '@/components/primary-button';
import { SeverityBadge } from '@/components/severity-badge';
import { ThemedText } from '@/components/themed-text';
import type { AllergyRow } from '@/db/schema';
import type { ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';
import { GENDER_OPTIONS, GenderLabel, type Gender } from '@/constants/gender';
import { RELATION_TO_PATIENT_OPTIONS, RelationToPatientLabel, type RelationToPatient } from '@/constants/relation-to-patient';
import { formatIsoDate, formatIsoDateTime } from '@/lib/format-date';
import { formatAddress } from '@/lib/format-address';

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
  return (
    <View className="gap-4">
      <ThemedText className="text-center text-lg font-semibold">{info.name || 'Unknown'}</ThemedText>

      <Card className="p-0">
        <View className="px-4">
          <InfoRow label="Generated" value={formatIsoDateTime(info.generatedAt) || '—'} />
          <InfoRow label="Date of birth" value={formatIsoDate(info.dateOfBirth) || '—'} />
          <InfoRow
            label="Gender"
            value={(GENDER_OPTIONS.includes(info.gender as Gender) ? GenderLabel[info.gender as Gender] : info.gender) || '—'}
          />
          <InfoRow label="No blood transfusion" value={info.noBloodTransfusion || '—'} />
          <InfoRow label="Phone" value={info.phone || '—'} last />
          <InfoRow
            label="Address"
            value={
              formatAddress({
                street: info.street,
                unit: info.unit,
                city: info.city,
                province: info.province,
                postal_code: info.postalCode,
                country: info.country,
              }) || '—'
            }
            last
          />
        </View>
      </Card>

      {showMedicalDetails && (
        <View className="gap-2">
          <ThemedText type="smallBold" color="mutedForeground">
            Emergency contacts
          </ThemedText>
          {info.emergencyContacts.length === 0 ? (
            <ThemedText color="mutedForeground">None recorded.</ThemedText>
          ) : (
            <Card className="p-0">
              <View className="px-4">
                {info.emergencyContacts.map((contact, i) => (
                  <View key={i}>
                    <InfoRow label="Name" value={contact.name} />
                    {contact.relationship && (
                      <InfoRow
                        label="Relationship"
                        value={
                          RELATION_TO_PATIENT_OPTIONS.includes(contact.relationship as RelationToPatient)
                            ? RelationToPatientLabel[contact.relationship as RelationToPatient]
                            : contact.relationship
                        }
                      />
                    )}
                    {contact.phone && <InfoRow label="Phone" value={contact.phone} last={i === info.emergencyContacts.length - 1} />}
                    {i < info.emergencyContacts.length - 1 && <View className="border-b border-border" />}
                  </View>
                ))}
              </View>
            </Card>
          )}
        </View>
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
