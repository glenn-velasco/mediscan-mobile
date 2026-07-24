import { Platform, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/primary-button';
import { useTheme } from '@/hooks/use-theme';

const SECTIONS = [
  {
    title: '1. Acceptance of Terms',
    body: 'Your download, access, or use of the MediScan application ("Application") signifies that you accept the terms set forth in this document. If you do not accept these terms, you must stop accessing or using the Application.',
  },
  {
    title: '2. Description of Service',
    body: 'MediScan is a mobile QR-code enabled platform intended to allow authorized medical personnel and emergency responders quick access to vital information pertaining to a patient\'s medical history, cultural determinants, and emergency contacts.',
  },
  {
    title: '3. User Accounts and Identity Verification (KYC)',
    bullets: [
      'Authorized Access: Access to the sensitive medical data contained within the Application is restricted to verified medical professionals and authorized first responders.',
      'Credential Verification: An authorized responder will voluntarily submit a PRC ID and undergo a biometric liveness test to register an account.',
      'Responsibility: You will have full responsibility for the confidentiality of your account. You promise not to give away your access rights and not to let anyone else access patient information from your mobile device.',
    ],
  },
  {
    title: '4. Data Privacy and Security',
    bullets: [
      'Regulations: The Application will strictly comply with the Philippine Data Privacy Act of 2012 (Republic Act No. 10173).',
      'Patient Consent: Only after scanning the QR code of the designated patient will patient medical data be available to you.',
      'Data Protection: All the personal information is encrypted. As a healthcare professional, you agree to handle all information received in strict confidence and use it exclusively in the course of providing emergency medical care.',
    ],
  },
  {
    title: '5. Acceptable Use',
    body: 'You agree to use the Application for legal purposes only. You shall not:',
    bullets: [
      'Use the Application to retrieve, reproduce, or disseminate patient data outside of established medical protocol.',
      'Interfere with the zero-knowledge encryption system, biometric authentication, or other security features of the Application.',
      'Provide false identity or use fraudulent PRC identification.',
    ],
  },
  {
    title: '6. Offline Functionality (BLE Relay)',
    body: 'The Application provides an offline Bluetooth Low Energy (BLE) relay mechanism for data synchronization in areas with poor cellular coverage. Although the offline synchronization system is highly reliable, you recognize the possibility that offline data synchronization is based on proximity and hardware conditions. Therefore, you must validate critical medical data whenever reconnected to the internet.',
  },
  {
    title: '7. Limitation of Liability',
    bullets: [
      'Medical Disclaimer: This Application is provided as a support system for emergency responders. It is not to be taken as a substitute for professional clinical judgment, established triage procedures, and primary medical documents.',
      'Warranties: The Application is delivered without any warranties with respect to its availability or absence of errors.',
      'Liability: In no event shall the developers, project team, or their affiliates be liable for any consequential damages, including but not limited to the adverse clinical outcomes or delay in treatment resulting from device malfunction, network capabilities, or any inability to use the Application.',
    ],
  },
  {
    title: '8. Modifications to Terms',
    body: 'These Terms may be changed or amended by us at any moment. Significant modifications in data processing or authentication policies will be notified to the user through the in-app notifications. Use of the Application following these amendments shall constitute agreement to the modified Terms.',
  },
];

export default function TermsScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: Platform.OS === 'ios' ? 56 : 40,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: theme.border,
        }}
      >
        <PrimaryButton label="Back" onPress={() => router.back()} variant="ghost" />
        <ThemedText type="heading" style={{ flex: 1, textAlign: 'center', marginRight: 60 }}>
          Terms of Service
        </ThemedText>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText type="caption" color="mutedForeground" className="mb-6">
          Effective July 2026
        </ThemedText>

        {SECTIONS.map((section) => (
          <View key={section.title} className="mb-6">
            <ThemedText type="heading" className="mb-2">
              {section.title}
            </ThemedText>
            {section.body ? (
              <ThemedText type="body" color="mutedForeground" className="mb-2">
                {section.body}
              </ThemedText>
            ) : null}
            {section.bullets?.map((bullet, i) => (
              <View key={i} className="mb-1 flex-row gap-2 pl-2">
                <ThemedText type="body" color="mutedForeground">
                  {'\u2022'}
                </ThemedText>
                <ThemedText type="body" color="mutedForeground" className="flex-1">
                  {bullet}
                </ThemedText>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <View
        style={{
          paddingHorizontal: 24,
          paddingBottom: Platform.OS === 'ios' ? 32 : 24,
          borderTopWidth: 1,
          borderTopColor: theme.border,
        }}
      >
        <PrimaryButton label="I have read this" onPress={() => router.back()} />
      </View>
    </View>
  );
}
