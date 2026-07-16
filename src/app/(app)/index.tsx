import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/useAuth';
import { AllergiesBottomSheet, type AllergiesBottomSheetHandle } from '@/components/allergies-bottom-sheet';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { DiagnosisSeverityBadge, DiagnosisSeverityIcon } from '@/components/diagnosis-severity-badge';
import { EmailVerificationBanner } from '@/components/email-verification-banner';
import { EmergencyContactsBottomSheet, type EmergencyContactsBottomSheetHandle } from '@/components/emergency-contacts-bottom-sheet';
import { EmptyState } from '@/components/empty-state';
import { GradientHeader } from '@/components/gradient-header';
import { AppLayout } from '@/components/layouts/app-layout';
import { QrBottomSheet, type QrBottomSheetHandle } from '@/components/qr-bottom-sheet';
import { QrIconButton } from '@/components/qr-icon-button';
import { SeverityBadge, SeverityIcon } from '@/components/severity-badge';
import { StatTile } from '@/components/stat-tile';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VerifiedCountBadge } from '@/components/verified-count-badge';
import type { Suffix } from '@/constants/suffix';
import * as medicalInformationRepo from '@/db/repositories/medical-information.repo';
import { useAllergies } from '@/features/allergies/useAllergies';
import { useDiagnoses } from '@/features/diagnoses/useDiagnoses';
import { useEmergencyContacts } from '@/features/emergency-contacts';
import { medicalInformationQueryKey, useMedicalInformation } from '@/features/medical-information/useMedicalInformation';
import { useAttestations } from '@/features/professional-attestations/useAttestations';
import { useQrWidget } from '@/features/qr-widget/useQrWidget';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';
import { pullPendingSync } from '@/services/pending-sync.service';

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const qrSheetRef = useRef<QrBottomSheetHandle>(null);
  const emergencyContactsSheetRef = useRef<EmergencyContactsBottomSheetHandle>(null);
  const allergiesSheetRef = useRef<AllergiesBottomSheetHandle>(null);
  const { user, refreshUser, logout } = useAuth();
  const { data: medicalInformation, isLoading } = useMedicalInformation();
  const { data: allergies = [] } = useAllergies();
  const { data: diagnoses = [] } = useDiagnoses();
  const { data: attestations = [] } = useAttestations();
  const { data: emergencyContacts = [] } = useEmergencyContacts();
  useQrWidget(user?.id ?? 0);

  const profile = medicalInformation ?? user?.medical_information ?? null;

  const diagnosisVerifiedCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of attestations) {
      if (a.envelope_type === 'diagnosis_verification' && a.matched_diagnosis_local_uuid) {
        map.set(a.matched_diagnosis_local_uuid, (map.get(a.matched_diagnosis_local_uuid) ?? 0) + 1);
      }
    }
    return map;
  }, [attestations]);

  const allergyVerifiedCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of attestations) {
      if (a.envelope_type === 'allergy_verification' && a.matched_allergy_local_uuid) {
        map.set(a.matched_allergy_local_uuid, (map.get(a.matched_allergy_local_uuid) ?? 0) + 1);
      }
    }
    return map;
  }, [attestations]);

  useEffect(() => {
    if (!medicalInformation && user?.medical_information && user) {
      const mi = user.medical_information;
      medicalInformationRepo.saveLocalEdit({
        email: user.email,
        first_name: user.first_name,
        middle_name: user.middle_name ?? undefined,
        last_name: user.last_name,
        suffix: (user.suffix as Suffix) ?? undefined,
        date_of_birth: mi.date_of_birth ?? undefined,
        gender: mi.gender ?? undefined,
        phone_country_code: user.phone_country_code,
        phone: user.phone_number,
        blood_type: mi.blood_type ?? undefined,
        religion: mi.religion,
        address: mi.address,
        no_blood_transfusion: mi.no_blood_transfusion,
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: medicalInformationQueryKey });
      });
    }
  }, [medicalInformation, user, queryClient]);

  const handleRefresh = useCallback(async () => {
    await refreshUser();
    void pullPendingSync();
    await queryClient.invalidateQueries();
  }, [refreshUser, queryClient]);

  if (isLoading) {
    return (
      <ThemedView className="flex-1 items-center justify-center" style={{ paddingTop: insets.top }}>
        <ThemedText>Loading…</ThemedText>
      </ThemedView>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1" style={{ paddingTop: insets.top }}>
          <EmailVerificationBanner />
          <ThemedView className="flex-1 items-center justify-center gap-4 px-6">
          <ThemedText className="text-center text-2xl font-semibold">Welcome, {user?.fullname}</ThemedText>
          <EmptyState
            title="Complete your profile"
            body="Your medical information helps others help you in an emergency."
            icon="person-add-outline"
          />
          <Link href="/profile/edit">
            <ThemedText type="linkPrimary">Complete profile</ThemedText>
          </Link>
          <Pressable onPress={() => logout()} className="mt-6">
            <ThemedText type="small" color="mutedForeground">Log out</ThemedText>
          </Pressable>
        </ThemedView>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <AppLayout onRefresh={handleRefresh} maxContentWidth={640}>
        <GradientHeader edgeToEdge topInset={insets.top}>
          <EmailVerificationBanner />
          <View className="mb-6 flex-row items-center gap-4">
          <Pressable onPress={() => router.push('/account')} hitSlop={8}>
            <Avatar
              name={profile.full_name || 'Unnamed'}
              size={56}
              className="bg-white/20"
              textColor="primaryForeground"
            />
          </Pressable>
          <View className="flex-1 gap-1">
            <ThemedText className="text-lg font-semibold" style={{ color: theme.primaryForeground }}>
              {profile.full_name || 'Unnamed'}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.primaryForeground, opacity: 0.8 }}>
              {profile.date_of_birth || '—'} · {profile.gender || '—'}
            </ThemedText>
          </View>
          {medicalInformation &&
            <QrIconButton onPress={() => qrSheetRef.current?.present()} />
          }
          </View>
        </GradientHeader>
        <View className="mb-6 gap-2">
          <View className="mb-1 flex-row items-center justify-between">
            <ThemedText type="overline">Medical information</ThemedText>
            <Link href="/profile/edit">
              <ThemedText type="small" color="primary" className="font-semibold">
                Edit
              </ThemedText>
            </Link>
          </View>
          <View className="gap-2">
            <StatTile
              icon="water"
              iconColor={theme.destructive}
              iconBgKey="destructive"
              label="Blood type"
              value={profile.blood_type || '—'}
              accent
            />
            <StatTile
              icon="call"
              iconColor={theme.primary}
              iconBgKey="primary"
              label="Phone"
              value={profile.phone || '—'}
              accent
            />
            <StatTile
              icon="book"
              iconColor={theme.warning}
              iconBgKey="warning"
              label="Religion"
              value={profile.religion || '—'}
              accent
            />
            <StatTile
              icon={profile.no_blood_transfusion ? 'shield-checkmark' : 'shield-outline'}
              iconColor={theme.success}
              iconBgKey="success"
              label="No blood transfusion"
              value={profile.no_blood_transfusion ? 'Yes' : 'No'}
              accent
            />
          </View>
          <Card className="mt-1 flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.primary + '15' }}>
              <Ionicons name="location" size={18} color={theme.primary} />
            </View>
            <View className="flex-1">
              <ThemedText type="small" color="mutedForeground">
                Address
              </ThemedText>
              <ThemedText type="body" className="font-semibold">{profile.address || '—'}</ThemedText>
            </View>
          </Card>
        </View>

        <View className="mb-6 gap-2">
          <View className="mb-1 flex-row items-center justify-between">
            <ThemedText type="overline">Emergency contacts</ThemedText>
            <View className="flex-row items-center gap-4">
              <Pressable onPress={() => emergencyContactsSheetRef.current?.present()} hitSlop={8}>
                <ThemedText type="small" color="primary" className="font-semibold">
                  View all
                </ThemedText>
              </Pressable>
              <Pressable onPress={() => emergencyContactsSheetRef.current?.presentAdd()} hitSlop={12}>
                <Ionicons name="add" size={20} color={theme.primary} />
              </Pressable>
            </View>
          </View>

          {emergencyContacts.length === 0 ? (
            <Pressable onPress={() => emergencyContactsSheetRef.current?.presentAdd()}>
              <Card>
                <View className="flex-row items-center gap-3">
                  <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.muted }}>
                    <Ionicons name="person-add" size={18} color={theme.mutedForeground} />
                  </View>
                  <ThemedText type="label" color="mutedForeground">Add your first emergency contact — it takes 10 seconds.</ThemedText>
                </View>
              </Card>
            </Pressable>
          ) : (
            <Card className="p-0">
              {emergencyContacts.map((contact, i) => (
                <Pressable
                  key={contact.local_uuid}
                  onPress={() => router.push({ pathname: '/emergency-contacts/[localUuid]', params: { localUuid: contact.local_uuid } })}
                >
                  <View
                    className={cn(
                      'flex-row items-center gap-3 px-4 py-3.5',
                      i < emergencyContacts.length - 1 && 'border-b border-border',
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
                              {contact.relationship}
                            </ThemedText>
                          </View>
                        </View>
                      ) : null}
                    </View>
                    {contact.phone ? (
                      <ThemedText type="small" color="primary">
                        {contact.phone_country_code ? `+${contact.phone_country_code} ` : ''}{contact.phone}
                      </ThemedText>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </Card>
          )}
        </View>

        <View className="gap-2">
          <View className="mb-1 flex-row items-center justify-between">
            <ThemedText type="overline">Allergies</ThemedText>
            <View className="flex-row items-center gap-4">
              <Pressable onPress={() => allergiesSheetRef.current?.present()} hitSlop={8}>
                <ThemedText type="small" color="primary" className="font-semibold">
                  View all
                </ThemedText>
              </Pressable>
              <Pressable onPress={() => allergiesSheetRef.current?.presentAdd()} hitSlop={12}>
                <Ionicons name="add" size={20} color={theme.primary} />
              </Pressable>
            </View>
          </View>

          {allergies.length === 0 ? (
            <Pressable onPress={() => allergiesSheetRef.current?.presentAdd()}>
              <Card>
                <View className="flex-row items-center gap-3">
                  <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.muted }}>
                    <Ionicons name="medical" size={18} color={theme.mutedForeground} />
                  </View>
                  <ThemedText type="label" color="mutedForeground">Add your first allergy — it takes 10 seconds.</ThemedText>
                </View>
              </Card>
            </Pressable>
          ) : (
            <Card className="p-0">
              {allergies.map((allergy, i) => (
                <Pressable
                  key={allergy.local_uuid}
                  onPress={() => router.push({ pathname: '/allergies/[id]', params: { id: allergy.local_uuid } })}
                >
                  <View
                    className={cn(
                      'flex-row items-center gap-3 px-4 py-3.5',
                      i < allergies.length - 1 && 'border-b border-border',
                    )}
                  >
                    <SeverityIcon severity={allergy.severity} size={36} />
                    <ThemedText className="flex-1 shrink font-semibold">{allergy.allergen}</ThemedText>
                    <View className="flex-row items-center gap-2">
                      <VerifiedCountBadge count={allergyVerifiedCount.get(allergy.local_uuid) ?? 0} />
                      <SeverityBadge severity={allergy.severity} />
                    </View>
                  </View>
                </Pressable>
              ))}
            </Card>
          )}
        </View>

        <View className="gap-2">
          <View className="mb-1 flex-row items-center justify-between">
            <ThemedText type="overline">Diagnoses</ThemedText>
            <View className="flex-row items-center gap-4">
              <Pressable onPress={() => router.push('/diagnoses')} hitSlop={8}>
                <ThemedText type="small" color="primary" className="font-semibold">
                  View all
                </ThemedText>
              </Pressable>
              <Pressable onPress={() => router.push('/diagnoses/new')} hitSlop={12}>
                <Ionicons name="add" size={20} color={theme.primary} />
              </Pressable>
            </View>
          </View>

          {diagnoses.length === 0 ? (
            <Pressable onPress={() => router.push('/diagnoses/new')}>
              <Card>
                <View className="flex-row items-center gap-3">
                  <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.muted }}>
                    <Ionicons name="medkit" size={18} color={theme.mutedForeground} />
                  </View>
                  <ThemedText type="label" color="mutedForeground">Add your first diagnosis — it takes 10 seconds.</ThemedText>
                </View>
              </Card>
            </Pressable>
          ) : (
            <Card className="p-0">
              {diagnoses.map((diagnosis, i) => (
                <Pressable
                  key={diagnosis.local_uuid}
                  onPress={() => router.push({ pathname: '/diagnoses/[id]', params: { id: diagnosis.local_uuid } })}
                >
                  <View
                    className={cn(
                      'flex-row items-center gap-3 px-4 py-3.5',
                      i < diagnoses.length - 1 && 'border-b border-border',
                    )}
                  >
                    <DiagnosisSeverityIcon severity={diagnosis.severity} size={36} />
                    <View className="flex-1 shrink">
                      <ThemedText className="font-semibold">{diagnosis.condition}</ThemedText>
                      {diagnosis.date_of_diagnosis ? (
                        <ThemedText type="small" color="mutedForeground">
                          Diagnosed {diagnosis.date_of_diagnosis}
                        </ThemedText>
                      ) : null}
                    </View>
                    <VerifiedCountBadge count={diagnosisVerifiedCount.get(diagnosis.local_uuid) ?? 0} />
                    <DiagnosisSeverityBadge severity={diagnosis.severity} />
                  </View>
                </Pressable>
              ))}
            </Card>
          )}
        </View>
      </AppLayout>
      <QrBottomSheet ref={qrSheetRef} />
      <EmergencyContactsBottomSheet ref={emergencyContactsSheetRef} />
      <AllergiesBottomSheet ref={allergiesSheetRef} />
    </View>
  );
}
