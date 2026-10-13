import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/card';
import { AccessGate } from '@/components/access-gate';
import { PrimaryButton } from '@/components/primary-button';
import { SeverityBadge } from '@/components/severity-badge';
import { ThemedText } from '@/components/themed-text';
import type { AllergyRow } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { formatIsoDate, formatIsoDateTime } from '@/lib/format-date';
import type { ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';
import type { EmergencyKnowledgeState, QrVerificationResult } from '@/types/emergency';
import { GenderLabel, type Gender } from '@/constants/gender';
import { BloodTypeLabel, type BloodType } from '@/constants/blood-type';

function ageFromDob(dob: string): number | null {
  if (!dob) return null;
  const birth = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

function EmptyKnowledge({ noun, state }: { noun: string; state?: EmergencyKnowledgeState }) {
  return <ThemedText selectable color="mutedForeground">{state === 'confirmed_none' ? `No known ${noun} — confirmed by patient` : `No ${noun} information recorded`}</ThemedText>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={{ gap: 8 }}><ThemedText type="overline">{title}</ThemedText><Card>{children}</Card></View>;
}

export function EmergencyView({ info, verification, onAddNote, onRecordEncounter, encounterReady = true, encounterExists = false, savedSnapshot = false, source = 'qr' }: {
  info: ScannedEmergencyInfo;
  verification: QrVerificationResult;
  savedSnapshot?: boolean;
  source?: 'qr' | 'dynamic-card' | 'printable-offline';
  onAddNote?: () => void;
  onRecordEncounter?: () => void;
  encounterReady?: boolean;
  encounterExists?: boolean;
}) {
  const theme = useTheme();
  const age = info.age ?? ageFromDob(info.dateOfBirth);
  const gender = info.gender?.trim();
  const genderLabel = gender ? (GenderLabel[gender as Gender] ?? gender) : 'Not recorded';
  const bloodType = BloodTypeLabel[info.bloodType as BloodType] ?? info.bloodType;
  const missingBloodType = info.withheld?.bloodType ? 'Not shared in this QR' : info.withheld ? 'Not recorded' : 'Not in QR';
  const streetLine = [info.street, info.unit, info.barangay].filter(Boolean).join(', ');
  const localityLine = [info.city, info.province, info.postalCode].filter(Boolean).join(', ');
  const address = [streetLine, localityLine, info.country].filter(Boolean).join('\n');
  const critical = info.allergies.filter((item) => item.severity === 'severe' || item.severity === 'life-threatening');
  const callableContact = info.emergencyContacts.find((contact) => (contact.phone ?? '').replace(/\D/g, '').length >= 3);
  const firstContact = callableContact ?? info.emergencyContacts[0];
  const verificationColor = verification.status === 'invalid' || verification.status === 'expired' ? theme.destructive : verification.status === 'valid' ? theme.success : theme.warning;

  return <View style={{ gap: 16 }}>
    {savedSnapshot ? <Card style={{ borderColor: theme.warning, borderWidth: 1 }}><ThemedText selectable type="bodyBold">Saved scan — may not reflect the patient&apos;s current QR</ThemedText></Card> : null}
    <Card style={{ backgroundColor: theme.primary + '12' }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Ionicons name={source === 'dynamic-card' ? 'cloud-done-outline' : 'cloud-offline-outline'} size={24} color={theme.primary} /><View style={{ flex: 1 }}><ThemedText selectable type="bodyBold">Emergency data loaded</ThemedText><ThemedText selectable color="mutedForeground">{source === 'dynamic-card' ? 'Source: printed card · retrieved online · last published snapshot' : source === 'printable-offline' ? 'Source: printed card · offline snapshot; may be outdated or revoked' : 'Source: on-phone QR · available offline'}</ThemedText></View></View></Card>

    <Section title="Emergency at a glance"><View style={{ gap: 10 }}>
      <ThemedText selectable type="bodyBold" style={{ color: info.allergies.length ? theme.destructive : theme.foreground }}>Allergies: {info.allergies.length ? info.allergies.map((item) => item.allergen).join(', ') : info.knowledge?.allergies === 'confirmed_none' ? 'None reported by patient' : 'Not recorded'}</ThemedText>
      <ThemedText selectable>Medications: {info.medications.length ? info.medications.map((item) => item.name).join(', ') : info.knowledge?.medications === 'confirmed_none' ? 'None reported by patient' : 'Not recorded'}</ThemedText>
      <ThemedText selectable>Conditions: {[...info.conditions.map((item) => item.description), ...info.diagnoses.map((item) => item.condition)].join(', ') || 'Not recorded'}</ThemedText>
      <ThemedText selectable style={info.noBloodTransfusion === 'Yes' ? { color: theme.destructive, fontWeight: '700' } : undefined}>Transfusion preference: {info.noBloodTransfusion === 'Yes' ? 'Patient reports refusal' : info.noBloodTransfusion || 'Not recorded'}</ThemedText>
      {firstContact ? <View style={{ gap: 4 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><ThemedText selectable style={{ flex: 1 }}>Contact: {firstContact.name}</ThemedText>{callableContact?.phone ? <Pressable accessibilityRole="button" accessibilityLabel={`Call ${callableContact.name}`} onPress={() => void Linking.openURL(`tel:${callableContact.phone!.replace(/[^+\d]/g, '')}`)} style={{ minWidth: 48, minHeight: 48, paddingHorizontal: 12, borderRadius: 999, backgroundColor: theme.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Ionicons name="call" size={20} color={theme.primaryForeground} /><ThemedText selectable style={{ color: theme.primaryForeground, fontWeight: '700' }}>Call</ThemedText></Pressable> : null}</View><ThemedText selectable color="mutedForeground">{callableContact?.phone || 'No callable phone number in this QR'}</ThemedText></View> : <ThemedText selectable>Emergency contact: Not recorded</ThemedText>}
      <ThemedText selectable color="mutedForeground">Patient information updated {formatIsoDateTime(info.lastUpdatedAt || info.generatedAt) || 'at an unknown time'}</ThemedText>
    </View></Section>
    {onRecordEncounter ? <AccessGate permissions={['verified professional']}><PrimaryButton label={encounterExists ? 'Edit or share encounter report' : 'Record encounter and vitals'} disabled={!encounterReady} onPress={onRecordEncounter} /></AccessGate> : null}

    {info.latestVerifiedEncounter ? <AccessGate permissions={['verified professional']}><Section title="Latest verified encounter"><View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name="shield-checkmark" size={20} color={theme.success} /><ThemedText selectable type="bodyBold" style={{ flex: 1 }}>Verified by {info.latestVerifiedEncounter.professionalName}</ThemedText></View>
      <ThemedText selectable color="mutedForeground">Recorded {formatIsoDateTime(info.latestVerifiedEncounter.recordedAt) || 'at an unknown time'}</ThemedText>
      {info.latestVerifiedEncounter.updatedAt && info.latestVerifiedEncounter.updatedAt !== info.latestVerifiedEncounter.recordedAt ? <ThemedText selectable color="mutedForeground">Updated {formatIsoDateTime(info.latestVerifiedEncounter.updatedAt)}</ThemedText> : null}
      {info.latestVerifiedEncounter.observations ? <View><ThemedText selectable type="bodyBold">Observations</ThemedText><ThemedText selectable>{info.latestVerifiedEncounter.observations}</ThemedText></View> : null}
      {info.latestVerifiedEncounter.actionsTaken ? <View><ThemedText selectable type="bodyBold">Actions taken</ThemedText><ThemedText selectable>{info.latestVerifiedEncounter.actionsTaken}</ThemedText></View> : null}
      {info.latestVerifiedEncounter.vitals.length ? <View style={{ gap: 6 }}><ThemedText selectable type="bodyBold">Vitals</ThemedText>{info.latestVerifiedEncounter.vitals.map((vital, index) => <View key={`${vital.kind}-${vital.measuredAt}-${index}`}><ThemedText selectable>{vital.kind.replaceAll('_', ' ')}: {vital.value} {vital.unit}</ThemedText><ThemedText selectable color="mutedForeground">Measured {formatIsoDateTime(vital.measuredAt) || 'at an unknown time'}{vital.recordedBy ? ` · ${vital.recordedBy}` : ''}</ThemedText></View>)}</View> : null}
    </View></Section></AccessGate> : null}

    {(critical.length > 0 || info.noBloodTransfusion === 'Yes') ? <Section title="Critical alerts"><View style={{ gap: 12 }}>
      {info.noBloodTransfusion === 'Yes' ? <ThemedText selectable type="heading" style={{ color: theme.destructive }}>⚠ Patient reports no blood transfusion</ThemedText> : null}
      {critical.map((item) => <View key={`${item.allergen}-${item.severity}`} style={{ gap: 3 }}><View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><ThemedText selectable type="bodyBold" style={{ flex: 1 }}>{item.allergen}</ThemedText><SeverityBadge severity={item.severity as AllergyRow['severity']} /></View>{item.reaction ? <ThemedText selectable color="mutedForeground">Reaction: {item.reaction}</ThemedText> : null}</View>)}
    </View></Section> : null}

    <Section title="Current medications">{info.medications.length ? <View style={{ gap: 12 }}>{info.medications.map((item) => <View key={`${item.name}-${item.dosage}`}><ThemedText selectable type="bodyBold">{item.name}</ThemedText><ThemedText selectable color="mutedForeground">{[item.dosage, item.frequency].filter(Boolean).join(' · ')}</ThemedText></View>)}</View> : <EmptyKnowledge noun="medication" state={info.knowledge?.medications} />}</Section>
    <Section title="Diagnoses and conditions">{info.diagnoses.length || info.conditions.length ? <View style={{ gap: 10 }}>{info.diagnoses.map((item) => <ThemedText selectable key={`d-${item.condition}`} type="bodyBold">{item.condition}</ThemedText>)}{info.conditions.map((item) => <ThemedText selectable key={`c-${item.description}`} type="bodyBold">{item.description}</ThemedText>)}</View> : <EmptyKnowledge noun="diagnosis or condition" state={info.knowledge?.conditions} />}</Section>
    <Section title="Blood type"><ThemedText selectable type="screenTitle" style={{ color: bloodType ? theme.destructive : theme.mutedForeground }}>{bloodType || missingBloodType}</ThemedText></Section>

    <Section title="Emergency contacts">{info.emergencyContacts.length ? <View style={{ gap: 12 }}>{info.emergencyContacts.map((contact) => <View key={`${contact.name}-${contact.phone}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ flex: 1 }}><ThemedText selectable type="bodyBold">{contact.name}</ThemedText>{contact.relationship ? <ThemedText selectable color="mutedForeground">{contact.relationship}</ThemedText> : null}</View>{contact.phone ? <Pressable accessibilityRole="button" accessibilityLabel={`Call ${contact.name}`} onPress={() => void Linking.openURL(`tel:${contact.phone!.replace(/[^+\d]/g, '')}`)} style={{ padding: 12, borderRadius: 999, backgroundColor: theme.primary }}><Ionicons name="call" size={22} color={theme.primaryForeground} /></Pressable> : null}</View>)}</View> : <ThemedText selectable color="mutedForeground">No emergency contacts recorded</ThemedText>}</Section>

    <Section title="Identity"><View style={{ gap: 4 }}><ThemedText selectable type="heading">{info.name || 'Identity not recorded'}</ThemedText><ThemedText selectable color="mutedForeground">{age !== null ? `Age ${age}` : info.dateOfBirth ? `Born ${formatIsoDate(info.dateOfBirth)}` : 'Age not in QR'}</ThemedText>{info.withheld?.dateOfBirth ? <ThemedText selectable color="mutedForeground">Date of birth not shared in this QR</ThemedText> : info.dateOfBirth && age !== null ? <ThemedText selectable color="mutedForeground">Born {formatIsoDate(info.dateOfBirth)}</ThemedText> : null}<ThemedText selectable color="mutedForeground">Gender: {genderLabel}</ThemedText></View></Section>
    <Section title="Address"><ThemedText selectable color={address ? undefined : 'mutedForeground'}>{address || 'Not recorded'}</ThemedText></Section>
    <Section title="Freshness and provenance"><View style={{ gap: 6 }}><ThemedText selectable>Generated {formatIsoDateTime(info.generatedAt) || 'Unknown'}</ThemedText><ThemedText selectable>Last updated {formatIsoDateTime(info.lastUpdatedAt || info.generatedAt) || 'Unknown'}</ThemedText><ThemedText selectable>Patient-entered emergency information</ThemedText><ThemedText selectable style={{ color: verificationColor }}>{verification.message}</ThemedText><ThemedText selectable color="mutedForeground">Decision support only. Confirm details when possible.</ThemedText></View></Section>
    {onAddNote ? <AccessGate permissions={['verified professional']}><PrimaryButton label="Add responder note" variant="primary" onPress={onAddNote} /></AccessGate> : null}
  </View>;
}
