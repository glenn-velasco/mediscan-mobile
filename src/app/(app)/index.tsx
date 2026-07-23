import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/useAuth';
import { AllergiesBottomSheet, type AllergiesBottomSheetHandle } from '@/components/allergies-bottom-sheet';
import { Avatar } from '@/components/avatar';
import { AvatarPreviewSheet, type AvatarPreviewSheetHandle } from '@/components/avatar-preview-sheet';
import { Card } from '@/components/card';
import { DiagnosesBottomSheet, type DiagnosesBottomSheetHandle } from '@/components/diagnoses-bottom-sheet';
import { DiagnosisSeverityBadge, DiagnosisSeverityIcon } from '@/components/diagnosis-severity-badge';
import { EmergencyContactsBottomSheet, type EmergencyContactsBottomSheetHandle } from '@/components/emergency-contacts-bottom-sheet';
import { EmptyState } from '@/components/empty-state';
import { GradientHeader } from '@/components/gradient-header';
import { InfoTile } from '@/components/info-tile';
import { AppLayout } from '@/components/layouts/app-layout';
import { MedicationsBottomSheet, type MedicationsBottomSheetHandle } from '@/components/medications-bottom-sheet';
import { NotificationBellButton } from '@/components/notification-bell-button';
import { QrIconButton } from '@/components/qr-icon-button';
import { SeverityBadge, SeverityIcon } from '@/components/severity-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VerifiedCountBadge } from '@/components/verified-count-badge';
import { BloodTypeLabel } from '@/constants/blood-type';
import { GenderLabel } from '@/constants/gender';
import { ReligionLabel } from '@/constants/religion';
import type { Suffix } from '@/constants/suffix';
import * as medicalInformationRepo from '@/db/repositories/medical-information.repo';
import { parseStoredAddress } from '@/db/repositories/medical-information.repo';
import { useAllergies } from '@/features/allergies/useAllergies';
import { useDiagnoses } from '@/features/diagnoses/useDiagnoses';
import { useEmergencyContacts } from '@/features/emergency-contacts';
import { medicalInformationQueryKey, useMedicalInformation } from '@/features/medical-information/useMedicalInformation';
import { useMedications } from '@/features/medications/useMedications';
import { useAttestations } from '@/features/professional-attestations/useAttestations';
import { useQrWidget } from '@/features/qr-widget/useQrWidget';
import { useTheme } from '@/hooks/use-theme';
import { buildFullName } from '@/lib/build-full-name';
import { cn } from '@/lib/cn';
import { formatAddress } from '@/lib/format-address';
import { formatIsoDate } from '@/lib/format-date';
import { useGuardedPress } from '@/lib/use-guarded-press';
import { pullPendingSync } from '@/services/pending-sync.service';

export default function HomeScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const avatarSheetRef = useRef<AvatarPreviewSheetHandle>(null);
  const emergencyContactsSheetRef = useRef<EmergencyContactsBottomSheetHandle>(null);
  const allergiesSheetRef = useRef<AllergiesBottomSheetHandle>(null);
  const diagnosesSheetRef = useRef<DiagnosesBottomSheetHandle>(null);
  const medicationsSheetRef = useRef<MedicationsBottomSheetHandle>(null);
  const { user, refreshUser, logout } = useAuth();
  const { data: medicalInformation, isLoading } = useMedicalInformation();
  const { data: allergies = [] } = useAllergies();
  const { data: diagnoses = [] } = useDiagnoses();
  const { data: medications = [] } = useMedications();
  const { data: attestations = [] } = useAttestations();
  const { data: emergencyContacts = [] } = useEmergencyContacts();
  useQrWidget(user?.id ?? 0);
  const guardedPush = useGuardedPress((href: Parameters<typeof router.push>[0]) => router.push(href));

  const profile = medicalInformation ?? user?.medical_information ?? null;
  const age = profile ? user?.age : null;

  /**
   * Counts distinct professionals currently verifying a record — not raw attestation rows, since one
   * professional re-scanning and re-confirming shouldn't inflate the badge. `attestations` is already
   * ordered newest-first (see professional-attestation.repo.ts), so the first row seen per
   * (matched uuid, professional) pair is that professional's latest action; a `note: '__unverify__'`
   * sentinel there means they've since turned their "Mark as verified" toggle off, so they're excluded.
   */
  const countVerifiedByLatestAction = useCallback((envelopeType: string, matchedUuidKey: 'matched_allergy_local_uuid' | 'matched_diagnosis_local_uuid' | 'matched_medication_local_uuid') => {
    const seen = new Set<string>();
    const map = new Map<string, Set<number>>();
    for (const a of attestations) {
      const matchedUuid = a[matchedUuidKey];
      if (a.envelope_type !== envelopeType || !matchedUuid) continue;
      const payload = a.payload as { verified_by?: { user_id?: number }; note?: string } | null;
      const userId = payload?.verified_by?.user_id;
      if (typeof userId !== 'number') continue;

      const seenKey = `${matchedUuid}:${userId}`;
      if (seen.has(seenKey)) continue;
      seen.add(seenKey);

      if (payload?.note === '__unverify__') continue;
      const set = map.get(matchedUuid) ?? new Set<number>();
      set.add(userId);
      map.set(matchedUuid, set);
    }
    const counts = new Map<string, number>();
    for (const [uuid, set] of map) counts.set(uuid, set.size);
    return counts;
  }, [attestations]);

  const diagnosisVerifiedCount = useMemo(
    () => countVerifiedByLatestAction('diagnosis_verification', 'matched_diagnosis_local_uuid'),
    [countVerifiedByLatestAction],
  );

  const allergyVerifiedCount = useMemo(
    () => countVerifiedByLatestAction('allergy_verification', 'matched_allergy_local_uuid'),
    [countVerifiedByLatestAction],
  );

  const medicationVerifiedCount = useMemo(
    () => countVerifiedByLatestAction('medication_verification', 'matched_medication_local_uuid'),
    [countVerifiedByLatestAction],
  );

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
        religion: mi.religion ?? undefined,
        address: mi.address ?? undefined,
        no_blood_transfusion: mi.no_blood_transfusion,
      }).then(() => {
        queryClient.invalidateQueries({ queryKey: medicalInformationQueryKey });
      });
    }
  }, [medicalInformation, user, queryClient]);

  const handleRefresh = useCallback(async () => {
    try {
      await refreshUser();
    } catch {
      // ignore — user state stays as-is
    }
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
          <ThemedView className="flex-1 items-center justify-center gap-4 px-6">
          <ThemedText className="text-center text-2xl font-semibold">
            Welcome, {user ? buildFullName({ first_name: user.first_name, middle_name: user.middle_name ?? undefined, last_name: user.last_name, suffix: (user.suffix as Suffix) ?? undefined }) : ''}
          </ThemedText>
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

  const firstName = profile.full_name?.split(/\s+/)[0] || user?.first_name || 'there';

  return (
    <View className="flex-1">
        <AppLayout onRefresh={handleRefresh} maxContentWidth={640} contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}>
        <GradientHeader edgeToEdge topInset={insets.top}>
          <View className="flex-row items-center gap-4">
            <Pressable onPress={() => avatarSheetRef.current?.present()} hitSlop={8} accessibilityLabel="View profile picture">
              <Avatar name={profile.full_name || 'Unnamed'} size={48} className="bg-white/20" textColor="primaryForeground" />
            </Pressable>
            <View className="flex-1 gap-1">
              <ThemedText className="text-xl font-semibold" style={{ color: theme.primaryForeground }}>
                Hi, {firstName}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.primaryForeground, opacity: 0.85 }}>
                Here's your medical profile at a glance.
              </ThemedText>
            </View>
            <NotificationBellButton onPress={() => guardedPush('/notifications')} />
          </View>
        </GradientHeader>
        <View className="mb-6 mt-5 gap-2">
          <View className="mb-1 flex-row items-center justify-between">
            <ThemedText type="overline">Personal information</ThemedText>
            <Link href="/profile/edit">
              <ThemedText type="small" color="primary" className="font-semibold">
                Edit
              </ThemedText>
            </Link>
          </View>
          <View className="gap-2">
            <InfoTile
              icon="person"
              iconColor={theme.primary}
              iconBgKey="primary"
              label="Name"
              value={profile.full_name || 'Unnamed'}
            />
            <View className="flex-row gap-2">
              <InfoTile
                icon="calendar"
                iconColor={theme.mutedForeground}
                iconBgKey="muted"
                label="Date of birth"
                value={profile.date_of_birth ? formatIsoDate(profile.date_of_birth) : '—'}
              />
            </View>
            <View className="flex-row gap-2">
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
                value={(profile.gender && GenderLabel[profile.gender]) || '—'}
              />
              <InfoTile
                icon="water"
                iconColor={theme.destructive}
                iconBgKey="destructive"
                label="Blood type"
                value={(profile.blood_type && BloodTypeLabel[profile.blood_type]) || '—'}
              />
            </View>
            <View className="flex-row gap-2">
              <InfoTile
                icon="call"
                iconColor={theme.primary}
                iconBgKey="primary"
                label="Phone"
                value={profile.phone || '—'}
              />
              <InfoTile
                icon="book"
                iconColor={theme.warning}
                iconBgKey="warning"
                label="Religion"
                value={(profile.religion && ReligionLabel[profile.religion]) || '—'}
              />
            </View>
            <InfoTile
              icon={profile.no_blood_transfusion ? 'shield-checkmark' : 'shield-outline'}
              iconColor={theme.success}
              iconBgKey="success"
              label="No blood transfusion"
              value={profile.no_blood_transfusion ? 'Yes' : 'No'}
            />
            <Card className="flex-row items-center gap-3">
              <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.primary + '15' }}>
                <Ionicons name="location" size={18} color={theme.primary} />
              </View>
              <View className="flex-1">
                <ThemedText type="small" color="mutedForeground">
                  Address
                </ThemedText>
                <ThemedText type="body" className="font-semibold">
                  {formatAddress(typeof profile.address === 'string' ? parseStoredAddress(profile.address) : profile.address) || '—'}
                </ThemedText>
              </View>
            </Card>
          </View>
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
                  <ThemedText type="label" color="mutedForeground" className="flex-1 shrink">Add your first emergency contact — it takes 10 seconds.</ThemedText>
                </View>
              </Card>
            </Pressable>
          ) : (
            <Card className="p-0">
              {emergencyContacts.map((contact, i) => (
                <Pressable
                  key={contact.local_uuid}
                  onPress={() => emergencyContactsSheetRef.current?.presentView(contact.local_uuid)}
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

        <View className="mb-6 gap-2">
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
                  <ThemedText type="label" color="mutedForeground" className="flex-1 shrink">Add your first allergy — it takes 10 seconds.</ThemedText>
                </View>
              </Card>
            </Pressable>
          ) : (
            <Card className="p-0">
              {allergies.map((allergy, i) => (
                <Pressable
                  key={allergy.local_uuid}
                  onPress={() => allergiesSheetRef.current?.presentView(allergy.local_uuid)}
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

        <View className="mb-6 gap-2">
          <View className="mb-1 flex-row items-center justify-between">
            <ThemedText type="overline">Diagnoses</ThemedText>
            <View className="flex-row items-center gap-4">
              <Pressable onPress={() => diagnosesSheetRef.current?.present()} hitSlop={8}>
                <ThemedText type="small" color="primary" className="font-semibold">
                  View all
                </ThemedText>
              </Pressable>
              <Pressable onPress={() => diagnosesSheetRef.current?.presentAdd()} hitSlop={12}>
                <Ionicons name="add" size={20} color={theme.primary} />
              </Pressable>
            </View>
          </View>

          {diagnoses.length === 0 ? (
            <Pressable onPress={() => diagnosesSheetRef.current?.presentAdd()}>
              <Card>
                <View className="flex-row items-center gap-3">
                  <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.muted }}>
                    <Ionicons name="medkit" size={18} color={theme.mutedForeground} />
                  </View>
                  <ThemedText type="label" color="mutedForeground" className="flex-1 shrink">Add your first diagnosis — it takes 10 seconds.</ThemedText>
                </View>
              </Card>
            </Pressable>
          ) : (
            <Card className="p-0">
              {diagnoses.map((diagnosis, i) => (
                <Pressable
                  key={diagnosis.local_uuid}
                  onPress={() => diagnosesSheetRef.current?.presentView(diagnosis.local_uuid)}
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
                          Diagnosed {formatIsoDate(diagnosis.date_of_diagnosis)}
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

        <View className="mb-6 gap-2">
          <View className="mb-1 flex-row items-center justify-between">
            <ThemedText type="overline">Medications</ThemedText>
            <View className="flex-row items-center gap-4">
              <Pressable onPress={() => medicationsSheetRef.current?.present()} hitSlop={8}>
                <ThemedText type="small" color="primary" className="font-semibold">
                  View all
                </ThemedText>
              </Pressable>
              <Pressable onPress={() => medicationsSheetRef.current?.presentAdd()} hitSlop={12}>
                <Ionicons name="add" size={20} color={theme.primary} />
              </Pressable>
            </View>
          </View>

          {medications.length === 0 ? (
            <Pressable onPress={() => medicationsSheetRef.current?.presentAdd()}>
              <Card>
                <View className="flex-row items-center gap-3">
                  <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.muted }}>
                    <Ionicons name="medical" size={18} color={theme.mutedForeground} />
                  </View>
                  <ThemedText type="label" color="mutedForeground" className="flex-1 shrink">Add your first medication — it takes 10 seconds.</ThemedText>
                </View>
              </Card>
            </Pressable>
          ) : (
            <Card className="p-0">
              {medications.map((medication, i) => (
                <Pressable
                  key={medication.local_uuid}
                  onPress={() => medicationsSheetRef.current?.presentView(medication.local_uuid)}
                >
                  <View
                    className={cn(
                      'flex-row items-center gap-3 px-4 py-3.5',
                      i < medications.length - 1 && 'border-b border-border',
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
                    <VerifiedCountBadge count={medicationVerifiedCount.get(medication.local_uuid) ?? 0} />
                  </View>
                </Pressable>
              ))}
            </Card>
          )}
        </View>
      </AppLayout>
      <View className="absolute inset-x-0 bottom-0 items-center">
        <View
          className="w-full flex-row items-center justify-between rounded-t-3xl border-t px-10 pt-3"
          style={{ backgroundColor: theme.card, borderColor: theme.border, paddingBottom: insets.bottom + 12 }}
        >
          <Pressable hitSlop={12} accessibilityLabel="Home" className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: theme.primary + '15' }}>
            <Ionicons name="home" size={24} color={theme.primary} />
          </Pressable>
          <Pressable onPress={() => guardedPush('/account')} hitSlop={12} accessibilityLabel="Settings" className="h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: theme.muted }}>
            <Ionicons name="settings-outline" size={24} color={theme.foreground} />
          </Pressable>
        </View>
        {medicalInformation && (
          <QrIconButton
            onPress={() => guardedPush('/quick-scan')}
            size={60}
            style={{
              position: 'absolute',
              top: -22,
              borderWidth: 4,
              borderColor: theme.background,
              elevation: 4,
              shadowColor: '#000',
              shadowOpacity: 0.15,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
            }}
          />
        )}
      </View>
      <AvatarPreviewSheet ref={avatarSheetRef} name={profile.full_name || 'Unnamed'} />
      <EmergencyContactsBottomSheet ref={emergencyContactsSheetRef} />
      <AllergiesBottomSheet ref={allergiesSheetRef} />
      <DiagnosesBottomSheet ref={diagnosesSheetRef} />
      <MedicationsBottomSheet ref={medicationsSheetRef} />
    </View>
  );
}
