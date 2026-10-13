import { ActivityIndicator, Image, ScrollView, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/empty-state';
import { Card } from '@/components/card';
import { AppLayout } from '@/components/layouts/app-layout';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useScannedPatientDetail } from '@/features/professional-scans/useScannedPatientDetail';
import { useProfessionalEncounters } from '@/features/professional-encounters/useProfessionalEncounters';
import { useTheme } from '@/hooks/use-theme';
import { formatIsoDate } from '@/lib/format-date';
import { BloodTypeLabel } from '@/constants/blood-type';
import { GenderLabel } from '@/constants/gender';
import { ReligionLabel } from '@/constants/religion';
import { useState } from 'react';

function PatientAvatar({ uri, name }: { uri: string | null; name: string }) {
  const theme = useTheme();
  const [imageError, setImageError] = useState(false);

  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || '?';

  if (uri && !imageError) {
    return (
      <Image
        source={{ uri }}
        style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: theme.accent }}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <View
      style={{
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: theme.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <ThemedText style={{ color: theme.accentForeground, fontWeight: '600', fontSize: 28 }}>
        {initials}
      </ThemedText>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <View className="flex-row justify-between py-2">
      <ThemedText type="small" color="mutedForeground">{label}</ThemedText>
      <ThemedText type="small" className="text-right flex-1 ml-4">{value}</ThemedText>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-4">
      <View className="p-4">
        <ThemedText type="overline" className="mb-2">{title}</ThemedText>
        {children}
      </View>
    </Card>
  );
}

export default function ScannedPatientDetailScreen() {
  const { patientId } = useLocalSearchParams<{ patientId: string }>();
  const { data: patient, isLoading } = useScannedPatientDetail(patientId ?? null);
  const encounters = useProfessionalEncounters(patientId);
  const theme = useTheme();

  if (isLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  if (!patient) {
    return (
      <AppLayout>
        <EmptyState title="Patient not found" body="This patient's data could not be loaded." />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {/* Header with avatar */}
        <View className="items-center mb-6">
          <PatientAvatar uri={patient.avatar ?? null} name={patient.full_name} />
          <ThemedText type="title" className="mt-3">{patient.full_name}</ThemedText>
          <View className="flex-row gap-3 mt-1">
            {patient.gender && (
              <ThemedText type="small" color="mutedForeground">
                {GenderLabel[patient.gender as keyof typeof GenderLabel] ?? patient.gender}
              </ThemedText>
            )}
          </View>
        </View>

        {/* Personal Info */}
        <Section title="Personal Information">
          <InfoRow label="Date of Birth" value={patient.date_of_birth ? formatIsoDate(patient.date_of_birth) : null} />
          <InfoRow label="Gender" value={patient.gender ? (GenderLabel[patient.gender as keyof typeof GenderLabel] ?? patient.gender) : null} />
          <InfoRow label="Blood Type" value={patient.blood_type ? (BloodTypeLabel[patient.blood_type as keyof typeof BloodTypeLabel] ?? patient.blood_type) : null} />
          <InfoRow label="Religion" value={patient.religion ? (ReligionLabel[patient.religion as keyof typeof ReligionLabel] ?? patient.religion) : null} />
          <InfoRow label="Phone" value={patient.phone ? `${patient.phone_country_code ?? ''} ${patient.phone}`.trim() : null} />
          <InfoRow label="Blood Transfusion" value={patient.no_blood_transfusion ? 'Not allowed' : 'Allowed'} />
        </Section>

        {/* Address */}
        {patient.address && (
          <Section title="Address">
            <InfoRow label="Street" value={patient.address.street} />
            <InfoRow label="Barangay" value={patient.address.barangay} />
            <InfoRow label="City" value={patient.address.city} />
            <InfoRow label="Province" value={patient.address.province} />
            <InfoRow label="Postal Code" value={patient.address.postal_code} />
            <InfoRow label="Country" value={patient.address.country} />
          </Section>
        )}

        {/* Allergies */}
        {patient.allergies && patient.allergies.length > 0 && (
          <Section title="Allergies">
            {patient.allergies.map((a) => (
              <View key={a.id} className="py-2 border-b border-border last:border-0">
                <ThemedText>{a.allergen}</ThemedText>
                {a.reaction && <ThemedText type="small" color="mutedForeground">{a.reaction}</ThemedText>}
              </View>
            ))}
          </Section>
        )}

        {/* Conditions */}
        {patient.conditions && patient.conditions.length > 0 && (
          <Section title="Conditions">
            {patient.conditions.map((c) => (
              <View key={c.id} className="py-2 border-b border-border last:border-0">
                <ThemedText>{c.description}</ThemedText>
              </View>
            ))}
          </Section>
        )}

        {/* Diagnoses */}
        {patient.diagnoses && patient.diagnoses.length > 0 && (
          <Section title="Diagnoses">
            {patient.diagnoses.map((d) => (
              <View key={d.id} className="py-2 border-b border-border last:border-0">
                <ThemedText>{d.condition}</ThemedText>
                {d.date_of_diagnosis && (
                  <ThemedText type="small" color="mutedForeground">
                    Diagnosed {formatIsoDate(d.date_of_diagnosis)}
                  </ThemedText>
                )}
              </View>
            ))}
          </Section>
        )}

        {/* Medications */}
        {patient.medications && patient.medications.length > 0 && (
          <Section title="Medications">
            {patient.medications.map((m) => (
              <View key={m.id} className="py-2 border-b border-border last:border-0">
                <ThemedText>{m.name}</ThemedText>
                <ThemedText type="small" color="mutedForeground">
                  {m.dosage} - {m.frequency}
                </ThemedText>
              </View>
            ))}
          </Section>
        )}

        {/* Emergency Contacts */}
        {patient.emergency_contacts && patient.emergency_contacts.length > 0 && (
          <Section title="Emergency Contacts">
            {patient.emergency_contacts.map((ec) => (
              <View key={ec.id} className="py-2 border-b border-border last:border-0">
                <ThemedText>{ec.name}</ThemedText>
                <ThemedText type="small" color="mutedForeground">
                  {ec.relationship ? `${ec.relationship} - ` : ''}{ec.phone ?? 'No phone'}
                </ThemedText>
              </View>
            ))}
          </Section>
        )}

        {encounters.data && encounters.data.length > 0 ? <Section title="My verified encounters">{encounters.data.map((encounter) => <View key={encounter.id} className="gap-2 py-2"><ThemedText>Updated {new Date(encounter.updatedAt).toLocaleString()}</ThemedText>{encounter.vitals.map((vital) => <View key={`${vital.kind}-${vital.measuredAt}`}><ThemedText type="small">{vital.kind.replaceAll('_', ' ')}: {vital.value} {vital.unit}</ThemedText><ThemedText type="small" color="mutedForeground">Recorded {new Date(vital.measuredAt).toLocaleString()} by {vital.verifiedBy?.name || vital.recordedBy || encounter.professional_name}</ThemedText></View>)}</View>)}</Section> : null}
      </ScrollView>
    </AppLayout>
  );
}
