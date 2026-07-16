import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { AppLayout } from '@/components/layouts/app-layout';
import { Card } from '@/components/card';
import { SeverityIcon, SeverityBadge } from '@/components/severity-badge';
import { DiagnosisSeverityIcon, DiagnosisSeverityBadge } from '@/components/diagnosis-severity-badge';
import { PickerField } from '@/components/form/picker-field';
import { PrimaryButton } from '@/components/primary-button';
import { useAuth } from '@/auth/useAuth';
import { useSubmitEnvelope } from '@/features/professional-sync/useSubmitEnvelope';
import { useTheme } from '@/hooks/use-theme';
import { parseEmergencySummary, type ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';
import { scanForPatient, connectAndSubmit } from '@/services/ble-central.service';
import { seal } from '@/services/sealed-box.service';
import type { AllergyVerificationEnvelope, DiagnosisVerificationEnvelope } from '@/lib/envelope-schema';
import type { EnvelopeType } from '@/api/types';
import type { DiagnosisSeverity } from '@/constants/diagnosis-severity';
import { GENDER_OPTIONS, type Gender } from '@/constants/gender';

const ALLERGY_SEVERITIES: AllergyVerificationEnvelope['severity'][] = ['mild', 'moderate', 'severe', 'life-threatening'];
const DIAGNOSIS_SEVERITIES: DiagnosisSeverity[] = ['chronic', 'ongoing', 'acute', 'critical'];

type ManageAllergy = {
  key: string;
  allergen: string;
  reaction: string;
  severity: AllergyVerificationEnvelope['severity'];
  isNew: boolean;
  deleted: boolean;
  editing: boolean;
};

type ManageDiagnosis = {
  key: string;
  condition: string;
  dateOfDiagnosis: string;
  severity: DiagnosisSeverity;
  isNew: boolean;
  deleted: boolean;
  editing: boolean;
};

function normaliseSeverity(raw: string): AllergyVerificationEnvelope['severity'] {
  const lower = raw.toLowerCase();
  if (ALLERGY_SEVERITIES.includes(lower as AllergyVerificationEnvelope['severity'])) return lower as AllergyVerificationEnvelope['severity'];
  return 'mild';
}

function normaliseDiagnosisSeverity(raw: string): DiagnosisSeverity {
  const lower = raw.toLowerCase();
  if (DIAGNOSIS_SEVERITIES.includes(lower as DiagnosisSeverity)) return lower as DiagnosisSeverity;
  return 'chronic';
}

function initAllergies(info: ScannedEmergencyInfo): ManageAllergy[] {
  return info.allergies.map((a, i) => ({
    key: `a:${i}`,
    allergen: a.allergen,
    reaction: a.reaction ?? '',
    severity: normaliseSeverity(a.severity),
    isNew: false,
    deleted: false,
    editing: false,
  }));
}

function initDiagnoses(info: ScannedEmergencyInfo): ManageDiagnosis[] {
  return info.diagnoses.map((d, i) => ({
    key: `d:${i}`,
    condition: d.condition,
    dateOfDiagnosis: d.dateOfDiagnosis ?? '',
    severity: normaliseDiagnosisSeverity(d.severity),
    isNew: false,
    deleted: false,
    editing: false,
  }));
}

export default function ProfessionalManageInfoScreen() {
  const { patientId: patientIdParam, qrData } = useLocalSearchParams<{ patientId: string; qrData?: string }>();
  const patientId = Number(patientIdParam);
  const router = useRouter();
  const theme = useTheme();
  const { user } = useAuth();
  const { mutateAsync: submitEnvelope } = useSubmitEnvelope();

  const [info, setInfo] = useState<ScannedEmergencyInfo | null>(null);
  const [parseError, setParseError] = useState(false);
  const [allergies, setAllergies] = useState<ManageAllergy[]>([]);
  const [diagnoses, setDiagnoses] = useState<ManageDiagnosis[]>([]);
  const [originalAllergies, setOriginalAllergies] = useState<ScannedEmergencyInfo['allergies']>([]);
  const [originalDiagnoses, setOriginalDiagnoses] = useState<ScannedEmergencyInfo['diagnoses']>([]);
  const [sending, setSending] = useState(false);
  const [sentSuccessfully, setSentSuccessfully] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [sendMode, setSendMode] = useState<'ble' | 'internet' | null>(null);

  useEffect(() => {
    if (!qrData) return;
    parseEmergencySummary(qrData).then((parsed) => {
      if (!parsed) {
        setParseError(true);
        return;
      }
      setInfo(parsed);
      setAllergies(initAllergies(parsed));
      setDiagnoses(initDiagnoses(parsed));
      setOriginalAllergies(parsed.allergies);
      setOriginalDiagnoses(parsed.diagnoses);
    });
  }, [qrData]);

  const setAllergy = useCallback((key: string, patch: Partial<ManageAllergy>) => {
    setAllergies((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  }, []);

  const setDiagnosis = useCallback((key: string, patch: Partial<ManageDiagnosis>) => {
    setDiagnoses((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }, []);

  const handleAddAllergy = useCallback(() => {
    const key = `a:new:${Date.now()}`;
    setAllergies((prev) => [
      { key, allergen: '', reaction: '', severity: 'mild', isNew: true, deleted: false, editing: true },
      ...prev,
    ]);
  }, []);

  const handleAddDiagnosis = useCallback(() => {
    const key = `d:new:${Date.now()}`;
    setDiagnoses((prev) => [
      { key, condition: '', dateOfDiagnosis: '', severity: 'chronic', isNew: true, deleted: false, editing: true },
      ...prev,
    ]);
  }, []);

  const handleEdit = useCallback((type: 'allergy' | 'diagnosis', key: string) => {
    if (type === 'allergy') setAllergy(key, { editing: true });
    else setDiagnosis(key, { editing: true });
  }, [setAllergy, setDiagnosis]);

  const handleCancelEdit = useCallback((type: 'allergy' | 'diagnosis', key: string) => {
    if (type === 'allergy') setAllergy(key, { editing: false });
    else setDiagnosis(key, { editing: false });
  }, [setAllergy, setDiagnosis]);

  const handleSaveEdit = useCallback((type: 'allergy' | 'diagnosis', key: string) => {
    if (type === 'allergy') setAllergy(key, { editing: false });
    else setDiagnosis(key, { editing: false });
  }, [setAllergy, setDiagnosis]);

  const handleDelete = useCallback((type: 'allergy' | 'diagnosis', key: string, label: string) => {
    Alert.alert(
      `Remove ${label}?`,
      `This will mark "${label}" for removal from the patient's record when you sync.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            if (type === 'allergy') setAllergy(key, { deleted: true, editing: false });
            else setDiagnosis(key, { deleted: true, editing: false });
          },
        },
      ],
    );
  }, [setAllergy, setDiagnosis]);

  const visibleAllergies = useMemo(() => allergies.filter((a) => !a.deleted), [allergies]);
  const visibleDiagnoses = useMemo(() => diagnoses.filter((d) => !d.deleted), [diagnoses]);

  const buildAllergyEnvelope = useCallback(
    (item: ManageAllergy, action: 'create' | 'update' | 'delete'): AllergyVerificationEnvelope => {
      if (!user) throw new Error('Not authenticated');
      const base = {
        type: 'allergy_verification' as const,
        version: 1 as const,
        allergen: item.allergen,
        reaction: item.reaction || null,
        severity: item.severity,
        verified_by: { user_id: user.id, name: user.fullname },
        verified_at: new Date().toISOString(),
      };
      if (action === 'delete') {
        return { ...base, note: '__delete__' };
      }
      if (action === 'create' || action === 'update') {
        return { ...base };
      }
      return base;
    },
    [user],
  );

  const buildDiagnosisEnvelope = useCallback(
    (item: ManageDiagnosis, action: 'create' | 'update' | 'delete'): DiagnosisVerificationEnvelope => {
      if (!user) throw new Error('Not authenticated');
      const base = {
        type: 'diagnosis_verification' as const,
        version: 1 as const,
        condition: item.condition,
        date_of_diagnosis: item.dateOfDiagnosis || null,
        severity: item.severity,
        verified_by: { user_id: user.id, name: user.fullname },
        verified_at: new Date().toISOString(),
      };
      if (action === 'delete') {
        return { ...base, note: '__delete__' };
      }
      return base;
    },
    [user],
  );

  const computeChanges = useCallback(() => {
    const changes: { type: 'create' | 'update' | 'delete'; envelope: AllergyVerificationEnvelope | DiagnosisVerificationEnvelope; envelopeType: EnvelopeType; label: string }[] = [];

    for (const item of allergies) {
      if (item.deleted) {
        const orig = originalAllergies.find((a) => a.allergen === item.allergen);
        if (orig) {
          changes.push({
            type: 'delete',
            envelope: buildAllergyEnvelope(item, 'delete'),
            envelopeType: 'allergy_verification',
            label: item.allergen,
          });
        }
      } else if (item.isNew) {
        changes.push({
          type: 'create',
          envelope: buildAllergyEnvelope(item, 'create'),
          envelopeType: 'allergy_verification',
          label: item.allergen,
        });
      } else {
        const orig = originalAllergies.find((a) => a.allergen === item.allergen);
        if (orig && (orig.severity !== item.severity || (orig.reaction ?? '') !== item.reaction)) {
          changes.push({
            type: 'update',
            envelope: buildAllergyEnvelope(item, 'update'),
            envelopeType: 'allergy_verification',
            label: item.allergen,
          });
        }
      }
    }

    for (const item of diagnoses) {
      if (item.deleted) {
        const orig = originalDiagnoses.find((d) => d.condition === item.condition);
        if (orig) {
          changes.push({
            type: 'delete',
            envelope: buildDiagnosisEnvelope(item, 'delete'),
            envelopeType: 'diagnosis_verification',
            label: item.condition,
          });
        }
      } else if (item.isNew) {
        changes.push({
          type: 'create',
          envelope: buildDiagnosisEnvelope(item, 'create'),
          envelopeType: 'diagnosis_verification',
          label: item.condition,
        });
      } else {
        const orig = originalDiagnoses.find((d) => d.condition === item.condition);
        if (orig && (orig.severity !== item.severity || (orig.dateOfDiagnosis ?? '') !== item.dateOfDiagnosis)) {
          changes.push({
            type: 'update',
            envelope: buildDiagnosisEnvelope(item, 'update'),
            envelopeType: 'diagnosis_verification',
            label: item.condition,
          });
        }
      }
    }

    return changes;
  }, [allergies, diagnoses, originalAllergies, originalDiagnoses, buildAllergyEnvelope, buildDiagnosisEnvelope]);

  const handleSendBle = useCallback(async () => {
    if (!user) return;
    setSending(true);
    setSyncError(null);
    setSendMode('ble');
    try {
      const changes = computeChanges();
      if (changes.length === 0) {
        router.back();
        return;
      }

      const peer = await scanForPatient(patientId, 20000);
      if (!peer) {
        setSyncError('Could not find the patient device nearby. Make sure they have Bluetooth sync open.');
        return;
      }

      for (const change of changes) {
        const ciphertext = await seal(change.envelope, peer.publicKeyBase64);
        const result = await connectAndSubmit(peer, change.envelopeType, ciphertext);
        if (result !== 'acked') {
          setSyncError(`"${change.label}" was not acknowledged by the patient device.`);
          return;
        }
      }

      setSentSuccessfully(true);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Bluetooth sync failed.');
    } finally {
      setSending(false);
      setSendMode(null);
    }
  }, [user, patientId, computeChanges, router]);

  const handleSendInternet = useCallback(async () => {
    if (!user) return;
    setSending(true);
    setSyncError(null);
    setSendMode('internet');
    try {
      const changes = computeChanges();
      if (changes.length === 0) {
        router.back();
        return;
      }

      for (const change of changes) {
        await submitEnvelope({ patientId, envelopeType: change.envelopeType, payload: change.envelope });
      }

      setSentSuccessfully(true);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Internet sync failed.');
    } finally {
      setSending(false);
      setSendMode(null);
    }
  }, [user, patientId, computeChanges, submitEnvelope, router]);

  if (parseError) {
    return (
      <AppLayout>
        <Card className="items-center gap-4 py-8">
          <ThemedText className="text-center">Could not read the patient&apos;s QR data.</ThemedText>
          <PrimaryButton label="Go back" variant="ghost" onPress={() => router.back()} />
        </Card>
      </AppLayout>
    );
  }

  if (!info) {
    return (
      <AppLayout>
        <Card className="items-center gap-4 py-8">
          <ThemedText className="text-center">Loading patient info…</ThemedText>
        </Card>
      </AppLayout>
    );
  }

  if (sentSuccessfully) {
    return (
      <AppLayout>
        <View className="flex-1 items-center justify-center gap-3 py-12">
          <View className="h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: theme.primary + '20' }}>
            <Ionicons name="checkmark-circle" size={36} color={theme.primary} />
          </View>
          <ThemedText type="heading" className="text-center">Update sent</ThemedText>
          <ThemedText type="caption" className="text-center">The patient will see this the next time their device syncs.</ThemedText>
        </View>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Card className="mb-4 gap-1">
        <ThemedText className="text-lg font-semibold">{info.name}</ThemedText>
        <ThemedText type="small" color="mutedForeground">
          {info.dateOfBirth} · {info.gender}
        </ThemedText>
        {info.phone && info.phone !== '—' ? (
          <ThemedText type="small" color="mutedForeground">{info.phone}</ThemedText>
        ) : null}
      </Card>

      {syncError ? (
        <Card className="mb-4" style={{ backgroundColor: theme.destructive + '15', borderColor: theme.destructive }}>
          <ThemedText type="small" color="destructive">{syncError}</ThemedText>
        </Card>
      ) : null}

      <View className="mb-6 gap-2">
        <View className="flex-row items-center justify-between">
          <ThemedText type="overline">Allergies</ThemedText>
          <Pressable onPress={handleAddAllergy} hitSlop={8} disabled={sending}>
            <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: theme.primary }}>
              <Ionicons name="add" size={16} color={theme.primaryForeground} />
            </View>
          </Pressable>
        </View>

        {visibleAllergies.length === 0 ? (
          <Card>
            <ThemedText type="label" color="mutedForeground">No allergies recorded for this patient.</ThemedText>
          </Card>
        ) : (
          <Card className="p-0">
            {visibleAllergies.map((item, i) => (
              <View
                key={item.key}
                className="px-4 py-3"
                style={i < visibleAllergies.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : undefined}
              >
                {item.editing ? (
                  <View className="gap-2">
                    {item.isNew ? (
                      <TextInput
                        className="rounded-lg border px-3 py-2 text-base"
                        style={{ borderColor: theme.input, color: theme.foreground }}
                        placeholder="Allergen name"
                        placeholderTextColor={theme.mutedForeground}
                        value={item.allergen}
                        onChangeText={(v) => setAllergy(item.key, { allergen: v })}
                      />
                    ) : null}
                    <PickerField
                      label="Severity"
                      options={ALLERGY_SEVERITIES}
                      value={item.severity}
                      onChange={(v) => setAllergy(item.key, { severity: v })}
                    />
                    <TextInput
                      className="rounded-lg border px-3 py-2 text-base"
                      style={{ borderColor: theme.input, color: theme.foreground }}
                      placeholder="Reaction (optional)"
                      placeholderTextColor={theme.mutedForeground}
                      value={item.reaction}
                      onChangeText={(v) => setAllergy(item.key, { reaction: v })}
                    />
                    <View className="flex-row gap-2">
                      <PrimaryButton label="Save" onPress={() => handleSaveEdit('allergy', item.key)} className="flex-1" />
                      <PrimaryButton label="Cancel" variant="ghost" onPress={() => handleCancelEdit('allergy', item.key)} className="flex-1" />
                    </View>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-3">
                    <SeverityIcon severity={item.severity} size={36} />
                    <View className="flex-1 shrink">
                      <ThemedText className="font-semibold">{item.allergen}</ThemedText>
                      {item.reaction ? (
                        <ThemedText type="small" color="mutedForeground">{item.reaction}</ThemedText>
                      ) : null}
                    </View>
                    <SeverityBadge severity={item.severity} />
                    <Pressable onPress={() => handleEdit('allergy', item.key)} hitSlop={6} disabled={sending}>
                      <Ionicons name="pencil" size={20} color={theme.mutedForeground} />
                    </Pressable>
                    <Pressable onPress={() => handleDelete('allergy', item.key, item.allergen)} hitSlop={6} disabled={sending}>
                      <Ionicons name="trash-outline" size={20} color={theme.destructive} />
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </Card>
        )}
      </View>

      <View className="mb-6 gap-2">
        <View className="flex-row items-center justify-between">
          <ThemedText type="overline">Diagnoses</ThemedText>
          <Pressable onPress={handleAddDiagnosis} hitSlop={8} disabled={sending}>
            <View className="h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: theme.primary }}>
              <Ionicons name="add" size={16} color={theme.primaryForeground} />
            </View>
          </Pressable>
        </View>

        {visibleDiagnoses.length === 0 ? (
          <Card>
            <ThemedText type="label" color="mutedForeground">No diagnoses recorded for this patient.</ThemedText>
          </Card>
        ) : (
          <Card className="p-0">
            {visibleDiagnoses.map((item, i) => (
              <View
                key={item.key}
                className="px-4 py-3"
                style={i < visibleDiagnoses.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : undefined}
              >
                {item.editing ? (
                  <View className="gap-2">
                    {item.isNew ? (
                      <TextInput
                        className="rounded-lg border px-3 py-2 text-base"
                        style={{ borderColor: theme.input, color: theme.foreground }}
                        placeholder="Condition name"
                        placeholderTextColor={theme.mutedForeground}
                        value={item.condition}
                        onChangeText={(v) => setDiagnosis(item.key, { condition: v })}
                      />
                    ) : null}
                    <PickerField
                      label="Severity"
                      options={DIAGNOSIS_SEVERITIES}
                      value={item.severity}
                      onChange={(v) => setDiagnosis(item.key, { severity: v })}
                    />
                    <TextInput
                      className="rounded-lg border px-3 py-2 text-base"
                      style={{ borderColor: theme.input, color: theme.foreground }}
                      placeholder="Date of diagnosis (optional)"
                      placeholderTextColor={theme.mutedForeground}
                      value={item.dateOfDiagnosis}
                      onChangeText={(v) => setDiagnosis(item.key, { dateOfDiagnosis: v })}
                    />
                    <View className="flex-row gap-2">
                      <PrimaryButton label="Save" onPress={() => handleSaveEdit('diagnosis', item.key)} className="flex-1" />
                      <PrimaryButton label="Cancel" variant="ghost" onPress={() => handleCancelEdit('diagnosis', item.key)} className="flex-1" />
                    </View>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-3">
                    <DiagnosisSeverityIcon severity={item.severity} size={36} />
                    <View className="flex-1 shrink">
                      <ThemedText className="font-semibold">{item.condition}</ThemedText>
                      {item.dateOfDiagnosis ? (
                        <ThemedText type="small" color="mutedForeground">Diagnosed {item.dateOfDiagnosis}</ThemedText>
                      ) : null}
                    </View>
                    <DiagnosisSeverityBadge severity={item.severity} />
                    <Pressable onPress={() => handleEdit('diagnosis', item.key)} hitSlop={6} disabled={sending}>
                      <Ionicons name="pencil" size={20} color={theme.mutedForeground} />
                    </Pressable>
                    <Pressable onPress={() => handleDelete('diagnosis', item.key, item.condition)} hitSlop={6} disabled={sending}>
                      <Ionicons name="trash-outline" size={20} color={theme.destructive} />
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
          </Card>
        )}
      </View>

      <View className="mt-2 gap-3">
        <PrimaryButton
          label={sendMode === 'ble' ? 'Syncing via Bluetooth…' : 'Send via Bluetooth'}
          loading={sendMode === 'ble'}
          disabled={sending}
          onPress={() => void handleSendBle()}
        />
        <PrimaryButton
          label={sendMode === 'internet' ? 'Sending via internet…' : 'Send via internet (beta)'}
          variant="ghost"
          loading={sendMode === 'internet'}
          disabled={sending}
          onPress={() => void handleSendInternet()}
        />
      </View>
    </AppLayout>
  );
}
