import { ActivityIndicator, ScrollView, View } from 'react-native';
import { Card } from '@/components/card';
import { AppLayout } from '@/components/layouts/app-layout';
import { ThemedText } from '@/components/themed-text';
import { useProfessionalEncounters } from '@/features/professional-encounters/useProfessionalEncounters';
import { useTheme } from '@/hooks/use-theme';

const vitalLabels = {
  blood_pressure: 'Blood pressure',
  heart_rate: 'Heart rate',
  respiratory_rate: 'Respiratory rate',
  temperature: 'Temperature',
  oxygen_saturation: 'Oxygen saturation',
} as const;

export default function EncounterReportsScreen() {
  const query = useProfessionalEncounters(); const theme = useTheme();
  return <AppLayout><ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 32 }}><ThemedText type="screenTitle">Verified encounters</ThemedText><ThemedText color="mutedForeground">Vitals and notes recorded by verified professionals appear here.</ThemedText>{query.isLoading ? <ActivityIndicator color={theme.primary} /> : null}{query.isError ? <Card><ThemedText color="destructive">Unable to load encounter reports.</ThemedText></Card> : null}{query.data?.length === 0 ? <Card><ThemedText>No verified encounters have been shared yet.</ThemedText></Card> : null}{query.data?.map((encounter) => <Card key={encounter.id} className="gap-3"><View className="gap-1"><ThemedText type="subtitle">{encounter.professional_name}</ThemedText><ThemedText type="small" color="mutedForeground">Verified professional · Encounter updated {new Date(encounter.updatedAt).toLocaleString()}</ThemedText></View>{encounter.observations ? <ThemedText>{encounter.observations}</ThemedText> : null}{encounter.actionsTaken ? <ThemedText>Actions: {encounter.actionsTaken}</ThemedText> : null}<View className="gap-2">{encounter.vitals.map((vital) => <View key={`${vital.kind}-${vital.measuredAt}`}><ThemedText type="smallBold">{vitalLabels[vital.kind]}: {vital.value} {vital.unit}</ThemedText><ThemedText type="small" color="mutedForeground">Recorded {new Date(vital.measuredAt).toLocaleString()} by {vital.verifiedBy?.name || vital.recordedBy || encounter.professional_name}</ThemedText></View>)}</View></Card>)}</ScrollView></AppLayout>;
}
