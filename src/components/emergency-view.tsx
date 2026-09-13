import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { Pressable, View } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { SeverityBadge } from '@/components/severity-badge';
import { ThemedText } from '@/components/themed-text';
import type { AllergyRow } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { formatIsoDate, formatIsoDateTime } from '@/lib/format-date';
import type { ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';
import type { EmergencyKnowledgeState, QrVerificationResult } from '@/types/emergency';
import { GenderLabel, type Gender } from '@/constants/gender';

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

export function EmergencyView({ info, verification, onScanAnother, onAddNote, savedSnapshot = false, source = 'qr', showScanAnother = false }: {
  info: ScannedEmergencyInfo;
  verification: QrVerificationResult;
  onScanAnother?: () => void;
  savedSnapshot?: boolean;
  source?: 'qr' | 'dynamic-card';
  showScanAnother?: boolean;
  onAddNote?: () => void;
}) {
  const theme = useTheme();
  const age = info.age ?? ageFromDob(info.dateOfBirth);
  const gender = info.gender?.trim();
  const genderLabel = gender ? (GenderLabel[gender as Gender] ?? gender) : 'Not recorded';
  const streetLine = [info.street, info.unit].filter(Boolean).join(', ');
  const localityLine = [info.city, info.province, info.postalCode].filter(Boolean).join(', ');
  const address = [streetLine, localityLine, info.country].filter(Boolean).join('\n');
  const critical = info.allergies.filter((item) => item.severity === 'severe' || item.severity === 'life-threatening');
  const verificationColor = verification.status === 'invalid' || verification.status === 'expired' ? theme.destructive : verification.status === 'valid' ? theme.success : theme.warning;

  return <View style={{ gap: 16 }}>
    {savedSnapshot ? <Card style={{ borderColor: theme.warning, borderWidth: 1 }}><ThemedText selectable type="bodyBold">Saved scan — may not reflect the patient&apos;s current QR</ThemedText></Card> : null}
    <Card style={{ backgroundColor: theme.primary + '12' }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><Ionicons name={source === 'dynamic-card' ? 'cloud-done-outline' : 'cloud-offline-outline'} size={24} color={theme.primary} /><View style={{ flex: 1 }}><ThemedText selectable type="bodyBold">{source === 'dynamic-card' ? 'Latest emergency data loaded' : 'Emergency data loaded from QR'}</ThemedText><ThemedText selectable color="mutedForeground">{source === 'dynamic-card' ? 'Retrieved from the patient’s dynamic wallet card' : 'No internet required'}</ThemedText></View></View></Card>

    {(critical.length > 0 || info.noBloodTransfusion === 'Yes') ? <Section title="Critical alerts"><View style={{ gap: 12 }}>
      {info.noBloodTransfusion === 'Yes' ? <ThemedText selectable type="heading" style={{ color: theme.destructive }}>⚠ Blood transfusion refused</ThemedText> : null}
      {critical.map((item) => <View key={`${item.allergen}-${item.severity}`} style={{ gap: 3 }}><View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><ThemedText selectable type="bodyBold" style={{ flex: 1 }}>{item.allergen}</ThemedText><SeverityBadge severity={item.severity as AllergyRow['severity']} /></View>{item.reaction ? <ThemedText selectable color="mutedForeground">Reaction: {item.reaction}</ThemedText> : null}</View>)}
    </View></Section> : null}

    <Section title="Current medications">{info.medications.length ? <View style={{ gap: 12 }}>{info.medications.map((item) => <View key={`${item.name}-${item.dosage}`}><ThemedText selectable type="bodyBold">{item.name}</ThemedText><ThemedText selectable color="mutedForeground">{[item.dosage, item.frequency].filter(Boolean).join(' · ')}</ThemedText></View>)}</View> : <EmptyKnowledge noun="medication" state={info.knowledge?.medications} />}</Section>
    <Section title="Diagnoses and conditions">{info.diagnoses.length || info.conditions.length ? <View style={{ gap: 10 }}>{info.diagnoses.map((item) => <ThemedText selectable key={`d-${item.condition}`} type="bodyBold">{item.condition}</ThemedText>)}{info.conditions.map((item) => <ThemedText selectable key={`c-${item.description}`} type="bodyBold">{item.description}</ThemedText>)}</View> : <EmptyKnowledge noun="diagnosis or condition" state={info.knowledge?.conditions} />}</Section>
    <Section title="Blood type"><ThemedText selectable type="screenTitle" style={{ color: info.bloodType ? theme.destructive : theme.mutedForeground }}>{info.bloodType || 'Not recorded'}</ThemedText></Section>

    <Section title="Emergency contacts">{info.emergencyContacts.length ? <View style={{ gap: 12 }}>{info.emergencyContacts.map((contact) => <View key={`${contact.name}-${contact.phone}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><View style={{ flex: 1 }}><ThemedText selectable type="bodyBold">{contact.name}</ThemedText>{contact.relationship ? <ThemedText selectable color="mutedForeground">{contact.relationship}</ThemedText> : null}</View>{contact.phone ? <Pressable accessibilityRole="button" accessibilityLabel={`Call ${contact.name}`} onPress={() => void Linking.openURL(`tel:${contact.phone!.replace(/[^+\d]/g, '')}`)} style={{ padding: 12, borderRadius: 999, backgroundColor: theme.primary }}><Ionicons name="call" size={22} color={theme.primaryForeground} /></Pressable> : null}</View>)}</View> : <ThemedText selectable color="mutedForeground">No emergency contacts recorded</ThemedText>}</Section>

    <Section title="Identity"><View style={{ gap: 4 }}><ThemedText selectable type="heading">{info.name || 'Identity not recorded'}</ThemedText><ThemedText selectable color="mutedForeground">{age !== null ? `Age ${age}` : info.dateOfBirth ? `Born ${formatIsoDate(info.dateOfBirth)}` : 'Age not recorded'}</ThemedText><ThemedText selectable color="mutedForeground">Gender: {genderLabel}</ThemedText></View></Section>
    <Section title="Address"><ThemedText selectable color={address ? undefined : 'mutedForeground'}>{address || 'Not recorded'}</ThemedText></Section>
    <Section title="Freshness and provenance"><View style={{ gap: 6 }}><ThemedText selectable>Generated {formatIsoDateTime(info.generatedAt) || 'Unknown'}</ThemedText><ThemedText selectable>Last updated {formatIsoDateTime(info.lastUpdatedAt || info.generatedAt) || 'Unknown'}</ThemedText><ThemedText selectable>Patient-entered emergency information</ThemedText><ThemedText selectable style={{ color: verificationColor }}>{verification.message}</ThemedText><ThemedText selectable color="mutedForeground">Decision support only. Confirm details when possible.</ThemedText></View></Section>
    {onAddNote ? <PrimaryButton label="Add responder note" variant="primary" onPress={onAddNote} /> : null}
    {showScanAnother ? <PrimaryButton label="Scan another" variant="outline" onPress={onScanAnother} /> : null}
  </View>;
}

