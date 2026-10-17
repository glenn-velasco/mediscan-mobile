import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/card';
import { AccessGate } from '@/components/access-gate';
import { InfoTile } from '@/components/info-tile';
import { PrimaryButton } from '@/components/primary-button';
import { SeverityBadge } from '@/components/severity-badge';
import { ThemedText } from '@/components/themed-text';
import { GENDER_OPTIONS, GenderLabel, type Gender } from '@/constants/gender';
import { BloodTypeLabel, type BloodType } from '@/constants/blood-type';
import { RELIGION_OPTIONS, ReligionLabel, type Religion } from '@/constants/religion';
import { RELATION_TO_PATIENT_OPTIONS, RelationToPatientLabel, type RelationToPatient } from '@/constants/relation-to-patient';
import type { AllergyRow } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';
import { formatAddress } from '@/lib/format-address';
import { formatIsoDate, formatIsoDateTime } from '@/lib/format-date';
import { formatPhoneWithCountryCode } from '@/lib/format-phone';
import type { ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';
import type { QrVerificationResult } from '@/types/emergency';
import type { EmergencyFieldChange } from '@/db/repositories/emergency-field-history.repo';

const VALID_SEVERITIES = new Set(['mild', 'moderate', 'severe', 'life-threatening']);

function formatHistoryValue(change: EmergencyFieldChange): string {
  if (change.value === null) return 'Not recorded';
  if (change.field === 'blood_type') return BloodTypeLabel[change.value as BloodType] ?? change.value;
  if (change.field === 'date_of_birth') return formatIsoDate(change.value) || change.value;
  return change.value;
}

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

const SCANNED_VITAL_ORDER = ['blood_pressure', 'heart_rate', 'respiratory_rate', 'temperature', 'oxygen_saturation'] as const;
const SCANNED_VITAL_LABELS: Record<(typeof SCANNED_VITAL_ORDER)[number], string> = {
  blood_pressure: 'Blood pressure',
  heart_rate: 'Heart rate',
  respiratory_rate: 'Respiratory rate',
  temperature: 'Temperature',
  oxygen_saturation: 'Oxygen saturation',
};

export function ScannedEmergencyCard({
  info,
  onRecordEncounter,
  onManageInfo,
  encounterReady = true,
  encounterExists = false,
  source,
  verification,
  showMedicalDetails = true,
}: {
  info: ScannedEmergencyInfo;
  onRecordEncounter?: () => void;
  onManageInfo?: () => void;
  encounterReady?: boolean;
  encounterExists?: boolean;
  source?: 'qr' | 'dynamic-card' | 'printable-offline';
  verification?: QrVerificationResult;
  showMedicalDetails?: boolean;
}) {
  const theme = useTheme();
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const age = info.age ?? calculateAge(info.dateOfBirth);
  const dateOfBirth = formatIsoDate(info.dateOfBirth);
  const personalPhone = formatPhoneWithCountryCode(info.phoneCountryCode, info.phone);
  const bloodType = BloodTypeLabel[info.bloodType as BloodType] ?? info.bloodType;
  const missingBloodType = info.withheld?.bloodType ? 'Not shared' : info.withheld ? 'Not recorded' : 'Not in QR';
  const omittedIdentity = [info.withheld?.dateOfBirth && 'date of birth', info.withheld?.phone && 'personal phone'].filter(Boolean).join(' and ');
  const callableContact = info.emergencyContacts.find((contact) => (contact.phone ?? '').replace(/\D/g, '').length >= 3);
  const verifiedEncounter = info.latestVerifiedEncounter;
  const latestVitalByKind = new Map((verifiedEncounter?.vitals ?? []).map((vital) => [vital.kind, vital]));
  const latestVerifiedVitals = SCANNED_VITAL_ORDER.flatMap((kind) => {
    const vital = latestVitalByKind.get(kind);
    return vital ? [{ ...vital, kind }] : [];
  });

  return (
    <View className="gap-4">
      <ThemedText type="heading" className="text-center">{info.name || 'Unknown'}</ThemedText>
      {source ? <Card><ThemedText selectable type="bodyBold">Emergency information</ThemedText><ThemedText selectable color="mutedForeground">{source === 'dynamic-card' ? 'Printed card · online published snapshot' : source === 'printable-offline' ? 'Printed card · offline snapshot' : 'On-phone QR · available offline'}</ThemedText><ThemedText selectable color="mutedForeground">Last updated {formatIsoDateTime(info.lastUpdatedAt || info.generatedAt) || 'unknown'}</ThemedText>{verification ? <ThemedText selectable color="mutedForeground">{verification.message}</ThemedText> : null}</Card> : null}
      {onRecordEncounter || onManageInfo ? (
        <AccessGate permissions={['verified professional']}>
          <View className="gap-2.5">
            {onRecordEncounter ? (
              <PrimaryButton
                label={encounterExists ? 'Open encounter and report' : 'Record encounter and vitals'}
                disabled={!encounterReady}
                onPress={onRecordEncounter}
              />
            ) : null}
            {onManageInfo ? (
              <PrimaryButton
                label="Manage patient information"
                variant="outline"
                leftIcon={<Ionicons name="medkit-outline" size={18} color={theme.primary} />}
                onPress={onManageInfo}
              />
            ) : null}
          </View>
        </AccessGate>
      ) : null}

      <View className="gap-2">
        {dateOfBirth ? <InfoTile
            fullWidth
            icon="calendar"
            iconColor={theme.mutedForeground}
            iconBgKey="muted"
            label="Date of birth"
            value={dateOfBirth}
          /> : null}
        {age !== null ? <InfoTile
            fullWidth
            icon="hourglass"
            iconColor={theme.primary}
            iconBgKey="primary"
            label="Age"
            value={`${age} yrs`}
          /> : null}
        <InfoTile
            fullWidth
            icon="male-female"
            iconColor={theme.warning}
            iconBgKey="warning"
            label="Gender"
            value={(GENDER_OPTIONS.includes(info.gender as Gender) ? GenderLabel[info.gender as Gender] : info.gender) || (source === 'printable-offline' && info.withheld?.dateOfBirth ? 'Not on this printout' : 'Not recorded')}
          />
        <InfoTile
            fullWidth
            icon="water"
            iconColor={theme.destructive}
            iconBgKey="destructive"
            label="Blood type"
            value={bloodType || missingBloodType}
          />
        {personalPhone ? <InfoTile
            fullWidth
            icon="call"
            iconColor={theme.primary}
            iconBgKey="primary"
            label="Phone"
            value={personalPhone}
          /> : null}
        {info.religion ? <InfoTile
            fullWidth
            icon="heart"
            iconColor={theme.primary}
            iconBgKey="primary"
            label="Religion"
            value={RELIGION_OPTIONS.includes(info.religion as Religion) ? ReligionLabel[info.religion as Religion] : info.religion}
          /> : null}
        <InfoTile
            fullWidth
            icon={info.noBloodTransfusion === 'Yes' ? 'shield-checkmark' : 'shield-outline'}
            iconColor={theme.success}
            iconBgKey="success"
            label="No blood transfusion"
            value={info.noBloodTransfusion || 'Not recorded'}
          />
        {omittedIdentity ? <ThemedText selectable type="small" color="mutedForeground">This QR does not share {omittedIdentity}.</ThemedText> : null}
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
                barangay: info.barangay,
                city: info.city,
                province: info.province,
                postal_code: info.postalCode,
                country: info.country,
              }) || '—'}
            </ThemedText>
          </View>
        </Card>
        <InfoTile
            fullWidth
            icon="time"
            iconColor={theme.mutedForeground}
            iconBgKey="muted"
            label="Generated"
            value={formatIsoDateTime(info.generatedAt) || '—'}
        />
      </View>

      {showMedicalDetails && verifiedEncounter && latestVerifiedVitals.length > 0 ? (
        <View className="gap-2">
          <ThemedText type="overline">Latest verified vitals</ThemedText>
          <Card className="p-0">
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.success + '15' }}>
                <Ionicons name="shield-checkmark" size={18} color={theme.success} />
              </View>
              <View className="flex-1">
                <ThemedText type="bodyBold">Verified by {verifiedEncounter.professionalName}</ThemedText>
                <ThemedText type="small" color="mutedForeground">{formatIsoDateTime(verifiedEncounter.updatedAt || verifiedEncounter.recordedAt) || 'Time unavailable'}</ThemedText>
              </View>
            </View>
            {latestVerifiedVitals.map((vital) => (
              <View key={vital.kind} className="flex-row items-center justify-between gap-3 border-t border-border px-4 py-3.5">
                <View className="flex-1">
                  <ThemedText type="small" color="mutedForeground">{SCANNED_VITAL_LABELS[vital.kind]}</ThemedText>
                  <ThemedText type="detail" color="mutedForeground">{formatIsoDateTime(vital.measuredAt) || 'Time unavailable'} · {vital.recordedBy || verifiedEncounter.professionalName}</ThemedText>
                </View>
                <ThemedText type="bodyBold">{vital.value} {vital.unit}</ThemedText>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

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
                    'flex-row items-start gap-3 px-4 py-3.5',
                    i < arr.length - 1 && 'border-b border-border',
                  )}
                >
                  <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.destructive + '15' }}>
                    <Ionicons name="person" size={18} color={theme.destructive} />
                  </View>
                  <View className="flex-1 gap-1">
                    <View className="flex-row items-start justify-between gap-2">
                      <ThemedText selectable className="flex-1 font-semibold">{contact.name}</ThemedText>
                      {contact.phone && contact.phone.replace(/\D/g, '').length >= 3 ? (
                        <View className="flex-row items-center" style={{ marginTop: -10, marginRight: -8 }}>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Call ${contact.name}`}
                            onPress={() => void Linking.openURL(`tel:${contact.phone!.replace(/[^+\d]/g, '')}`)}
                            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Ionicons name="call-outline" size={18} color={theme.mutedForeground} />
                          </Pressable>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`Message ${contact.name}`}
                            onPress={() => void Linking.openURL(`sms:${contact.phone!.replace(/[^+\d]/g, '')}`)}
                            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                          >
                            <Ionicons name="chatbubble-outline" size={18} color={theme.mutedForeground} />
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                    {contact.relationship || contact.phone ? (
                      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-1">
                        {contact.relationship ? (
                          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: theme.muted }}>
                            <ThemedText type="detail" color="mutedForeground">
                              {RELATION_TO_PATIENT_OPTIONS.includes(contact.relationship as RelationToPatient)
                                ? RelationToPatientLabel[contact.relationship as RelationToPatient]
                                : contact.relationship}
                            </ThemedText>
                          </View>
                        ) : null}
                        {contact.phone ? <ThemedText selectable type="small" color="primary">{contact.phone}</ThemedText> : null}
                      </View>
                    ) : null}
                  </View>
                </View>
              ))}
              {!callableContact ? <ThemedText selectable color="mutedForeground" style={{ padding: 12 }}>No callable phone number in this QR.</ThemedText> : null}
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
                <ThemedText type="label" color="mutedForeground" className="flex-1 shrink">{info.knowledge?.allergies === 'confirmed_none' ? 'None reported by patient.' : 'Not recorded.'}</ThemedText>
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
                <ThemedText type="label" color="mutedForeground" className="flex-1 shrink">{info.knowledge?.conditions === 'confirmed_none' ? 'None reported by patient.' : 'Not recorded.'}</ThemedText>
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
          <ThemedText type="overline">Diagnoses</ThemedText>
          {!info.diagnoses || info.diagnoses.length === 0 ? (
            <Card>
              <View className="flex-row items-center gap-3">
                <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.muted }}>
                  <Ionicons name="medkit" size={18} color={theme.mutedForeground} />
                </View>
                <ThemedText type="label" color="mutedForeground" className="flex-1 shrink">{info.knowledge?.diagnoses === 'confirmed_none' ? 'None reported by patient.' : 'Not recorded.'}</ThemedText>
              </View>
            </Card>
          ) : (
            <Card className="p-0">
              {info.diagnoses.filter(Boolean).map((diagnosis, i, arr) => (
                <View
                  key={`diagnosis-${diagnosis.condition}-${diagnosis.severity || ''}-${diagnosis.dateOfDiagnosis || ''}-${i}`}
                  className={cn(
                    'flex-row items-center gap-3 px-4 py-3.5',
                    i < arr.length - 1 && 'border-b border-border',
                  )}
                >
                  <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.primary + '15' }}>
                    <Ionicons name="medkit" size={18} color={theme.primary} />
                  </View>
                  <View className="flex-1 shrink">
                    <ThemedText className="font-semibold">{diagnosis.condition}</ThemedText>
                    {diagnosis.dateOfDiagnosis ? (
                      <ThemedText type="small" color="mutedForeground">
                        Diagnosed {formatIsoDate(diagnosis.dateOfDiagnosis)}
                      </ThemedText>
                    ) : null}
                  </View>
                  {diagnosis.severity && VALID_SEVERITIES.has(diagnosis.severity) ? (
                    <SeverityBadge severity={diagnosis.severity as AllergyRow['severity']} />
                  ) : diagnosis.severity ? (
                    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: theme.muted }}>
                      <ThemedText type="detail" color="mutedForeground">
                        {diagnosis.severity}
                      </ThemedText>
                    </View>
                  ) : null}
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
                <ThemedText type="label" color="mutedForeground" className="flex-1 shrink">{info.knowledge?.medications === 'confirmed_none' ? 'None reported by patient.' : 'Not recorded.'}</ThemedText>
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

      {showMedicalDetails && Boolean(info.recentHistory?.length) ? (
        <Card className="gap-3">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Recent emergency information changes"
            accessibilityState={{ expanded: historyExpanded }}
            onPress={() => setHistoryExpanded((current) => !current)}
            className="flex-row items-center justify-between"
            style={{ minHeight: 44 }}
          >
            <ThemedText type="bodyBold">Recent information changes</ThemedText>
            <Ionicons name={historyExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.mutedForeground} />
          </Pressable>
          {historyExpanded ? (
            <View className="gap-3">
              <ThemedText selectable type="small" color="mutedForeground">
                Patient-entered history in this scan. Earlier values may no longer be current; confirm when possible.
              </ThemedText>
              {info.recentHistory?.map((change) => (
                <View key={change.id} className="gap-0.5">
                  <ThemedText selectable type="smallBold">
                    {change.field === 'blood_type' ? 'Blood type' : change.field === 'date_of_birth' ? 'Date of birth' : 'No blood transfusion'}: {formatHistoryValue(change)}
                  </ThemedText>
                  <ThemedText selectable type="small" color="mutedForeground">
                    Entered {formatIsoDateTime(change.changedAt) || 'at an unknown time'}{change.syncStatus === 'pending' ? ' · Pending sync' : ''}
                  </ThemedText>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

    </View>
  );
}
