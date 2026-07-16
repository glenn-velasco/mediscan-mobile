import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { AppLayout } from '@/components/layouts/app-layout';
import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { useTheme } from '@/hooks/use-theme';

export default function ProfessionalLandingScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <AppLayout>
      <Card className="mb-6 items-center gap-3 py-8">
        <View className="h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: theme.primary + '26' }}>
          <Ionicons name="medkit" size={28} color={theme.primary} />
        </View>
        <ThemedText type="heading" className="text-center">
          Submit a patient update
        </ThemedText>
        <ThemedText type="caption" className="max-w-xs text-center">
          Scan a patient&apos;s sync code to verify an allergy, witness a transfusion consent, or leave a note on
          their record. The patient&apos;s medical data stays encrypted end-to-end — this app never reads it.
        </ThemedText>
      </Card>

      <PrimaryButton label="Scan patient code" onPress={() => router.push('/professional/scan')} />

      <ThemedText type="small" color="mutedForeground" className="mt-4 text-center">
        You&apos;ll need to be a verified professional to submit an update. If you&apos;re not verified yet, the
        next screen will let you know.
      </ThemedText>
    </AppLayout>
  );
}
