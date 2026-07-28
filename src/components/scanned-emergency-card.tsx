import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

import { Card } from '@/components/card';
import { InfoTile } from '@/components/info-tile';
import { PrimaryButton } from '@/components/primary-button';
import { SeverityBadge } from '@/components/severity-badge';
import { ThemedText } from '@/components/themed-text';
import { GENDER_OPTIONS, GenderLabel, type Gender } from '@/constants/gender';
import { RELATION_TO_PATIENT_OPTIONS, RelationToPatientLabel, type RelationToPatient } from '@/constants/relation-to-patient';
import type { AllergyRow } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';
import { formatAddress } from '@/lib/format-address';
import { formatIsoDate, formatIsoDateTime } from '@/lib/format-date';
import { formatPhoneWithCountryCode } from '@/lib/format-phone';
import type { ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';

function calculateAge(dob: string): number | null {
  if (!dob) return null;
  const [year, month, day] = dob.split('-').map(Number);
  const birth = new Date(year, month - 1, day);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

export function ScannedEmergencyCard({
  info,
  onScanAnother,
  showMedicalDetails = true,
}: {
  info: ScannedEmergencyInfo;
  onScanAnother: () => void;
  showMedicalDetails?: boolean;
}) {
  const theme = useTheme();
  const age = calculateAge(info.dateOfBirth);

  return (
    <View className="gap-4">
      <ThemedText type="heading" className="text-center">{info.name || 'Unknown'}</ThemedText>

      <View className="gap-2">
        <View className="flex-row gap-2">
          <InfoTile
            icon="calendar"
            iconColor={theme.mutedForeground}
            iconBgKey="muted"
            label="Date of birth"
            value={formatIsoDate(info.dateOfBirth) || '—'}
          />
          <InfoTile
            icon="hourglass"
            iconColor={theme.primary}
            iconBgKey="primary"
            label="Age"
            value={age !== null ? `${age} yrs` : '—'}
          />
        </View>
        <View className="flex-row gap-2">
          <InfoTile
            icon="male-female"
            iconColor={theme.warning}
            iconBgKey="warning"
            label="Gender"
            value={(GENDER_OPTIONS.includes(info.gender as Gender) ? GenderLabel[info.gender as Gender] : info.gender) || '—'}
          />
          <InfoTile
            icon="water"
            iconColor={theme.destructive}
            iconBgKey="destructive"
            label="Blood type"
            value={info.bloodType || '—'}
          />
        </View>
        <View className="flex-row gap-2">
          <InfoTile
            icon="call"
            iconColor={theme.primary}
            iconBgKey="primary"
            label="Phone"
            value={formatPhoneWithCountryCode(info.phoneCountryCode, info.phone) || '—'}
          />
          <InfoTile
            icon={info.noBloodTransfusion === 'Yes' ? 'shield-checkmark' : 'shield-outline'}
            iconColor={theme.success}
            iconBgKey="success"
            label="No blood transfusion"
            value={info.noBloodTransfusion || '—'}
          />
        </View>
        <Card className="flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.primary + '15' }}>
            <Ionicons name="location" size={18} color={theme.primary} />
          </View>
          <View className="flex-1">
            <ThemedText type="small" color="mutedForeground">
              Address
            </ThemedText>
            <ThemedText type="bodyBold">
              {formatAddress({
                street: info.street,
                unit: info.unit,
                city: info.city,
                province: info.province,
                postal_code: info.postalCode,
                country: info.country,
              }) || '—'}
            </ThemedText>
          </View>
        </Card>
        <InfoTile
          icon="time"
          iconColor={theme.mutedForeground}
          iconBgKey="muted"
          label="Generated"
          value={formatIsoDateTime(info.generatedAt) || '—'}
        />
      </View>

      {showMedicalDetails && (
        <View className="gap-2">
          <ThemedText type="overline">Emergency contacts</ThemedText>
          {!info.emergencyContacts || info.emergencyContacts.length === 0 ? (
            <Card>
              <View className="flex-row items-center gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.muted }}>
                  <Ionicons name="person-add" size={18} color={theme.mutedForeground} />
                </View>
                <ThemedText type="label" color="mutedForeground" className="flex-1 shrink">None recorded.</ThemedText>
              </View>
            </Card>
          ) : (
            <Card className="p-0">
              {info.emergencyContacts.filter(Boolean).map((contact, i, arr) => (
                <View
                  key={`contact-${contact.name}-${contact.phone || contact.relationship || 'none'}`}
                  className={cn(
                    'flex-row items-center gap-3 px-4 py-3.5',
                    i < arr.length - 1 && 'border-b border-border',
                  )}
                >
                  <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.destructive + '15' }}>
                    <Ionicons name="person" size={18} color={theme.destructive} />
                  </View>
                  <View className="flex-1">
                    <ThemedText className="font-semibold">{contact.name}</ThemedText>
                    {contact.relationship ? (
                      <View className="mt-1 flex-row items-center gap-1.5">
                        <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: theme.muted }}>
                          <ThemedText type="detail" color="mutedForeground">
                            {RELATION_TO_PATIENT_OPTIONS.includes(contact.relationship as RelationToPatient)
                              ? RelationToPatientLabel[contact.relationship as RelationToPatient]
                              : contact.relationship}
                          </ThemedText>
                        </View>
                      </View>
                    ) : null}
                  </View>
                  {contact.phone ? (
                    <ThemedText type="small" color="primary">
                      {contact.phone}
                    </ThemedText>
                  ) : null}
                </View>
              ))}
            </Card>
          )}
        </View>
      )}

      {showMedicalDetails && (
        <View className="gap-2">
          <ThemedText type="overline">Allergies</ThemedText>
          {!info.allergies || info.allergies.length === 0 ? (
            <Card>
              <View className="flex-row items-center gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.muted }}>
                  <Ionicons name="medical" size={18} color={theme.mutedForeground} />
                </View>
                <ThemedText type="label" color="mutedForeground" className="flex-1 shrink">None recorded.</ThemedText>
              </View>
            </Card>
          ) : (
            <Card className="p-0">
              {info.allergies.filter(Boolean).map((allergy, i, arr) => (
                <View
                  key={`allergy-${allergy.allergen}-${allergy.severity}`}
                  className={cn(
                    'flex-row items-center gap-3 px-4 py-3.5',
                    i < arr.length - 1 && 'border-b border-border',
                  )}
                >
                  <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.warning + '15' }}>
                    <Ionicons name="warning" size={18} color={theme.warning} />
                  </View>
                  <ThemedText className="flex-1 shrink font-semibold">{allergy.allergen}</ThemedText>
                  <SeverityBadge severity={allergy.severity as AllergyRow['severity']} />
                </View>
              ))}
            </Card>
          )}
        </View>
      )}

      {showMedicalDetails && (
        <View className="gap-2">
          <ThemedText type="overline">Conditions</ThemedText>
          {!info.conditions || info.conditions.length === 0 ? (
            <Card>
              <View className="flex-row items-center gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.muted }}>
                  <Ionicons name="fitness" size={18} color={theme.mutedForeground} />
                </View>
                <ThemedText type="label" color="mutedForeground" className="flex-1 shrink">None recorded.</ThemedText>
              </View>
            </Card>
          ) : (
            <Card className="p-0">
              {info.conditions.filter(Boolean).map((condition, i, arr) => (
                <View
                  key={`condition-${condition.description}`}
                  className={cn(
                    'flex-row items-center gap-3 px-4 py-3.5',
                    i < arr.length - 1 && 'border-b border-border',
                  )}
                >
                  <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.primary + '15' }}>
                    <Ionicons name="fitness" size={18} color={theme.primary} />
                  </View>
                  <ThemedText className="flex-1 shrink font-semibold">{condition.description}</ThemedText>
                </View>
              ))}
            </Card>
          )}
        </View>
      )}

      {showMedicalDetails && (
        <View className="gap-2">
          <ThemedText type="overline">Medications</ThemedText>
          {!info.medications || info.medications.length === 0 ? (
            <Card>
              <View className="flex-row items-center gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.muted }}>
                  <Ionicons name="medical" size={18} color={theme.mutedForeground} />
                </View>
                <ThemedText type="label" color="mutedForeground" className="flex-1 shrink">None recorded.</ThemedText>
              </View>
            </Card>
          ) : (
            <Card className="p-0">
              {info.medications.filter(Boolean).map((medication, i, arr) => (
                <View
                  key={`medication-${medication.name}-${medication.dosage || medication.frequency || 'none'}`}
                  className={cn(
                    'flex-row items-center gap-3 px-4 py-3.5',
                    i < arr.length - 1 && 'border-b border-border',
                  )}
                >
                  <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.primary + '15' }}>
                    <Ionicons name="medical" size={18} color={theme.primary} />
                  </View>
                  <View className="flex-1 shrink">
                    <ThemedText className="font-semibold">{medication.name}</ThemedText>
                    {medication.dosage || medication.frequency ? (
                      <ThemedText type="small" color="mutedForeground">
                        {[medication.dosage, medication.frequency].filter(Boolean).join(' · ')}
                      </ThemedText>
                    ) : null}
                  </View>
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
