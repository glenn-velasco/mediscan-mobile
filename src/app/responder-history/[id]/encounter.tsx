import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';

import { Card } from '@/components/card';
import { useAuth } from '@/auth/useAuth';
import { saveProfessionalEncounter } from '@/api/endpoints/professional-scans';
import { TextField } from '@/components/form/text-field';
import { PrimaryButton } from '@/components/primary-button';
import { ResponderMarkdownNote } from '@/components/responder-markdown-note';
import { ThemedText } from '@/components/themed-text';
import * as historyRepo from '@/db/repositories/recent-emergency-scans.repo';
import { useTheme } from '@/hooks/use-theme';
import { shareResponderReport } from '@/services/responder-report.service';
import type { EncounterVital, RecentEmergencyScan, ResponderEncounter, ResponderNoteBlock } from '@/types/emergency';
import { encounterVitalsSchema } from '@/lib/validation/encounter-vitals-schema';

const vitalFields: { kind: EncounterVital['kind']; label: string; unit: string }[] = [
  { kind: 'blood_pressure', label: 'Blood pressure', unit: 'mmHg' },
  { kind: 'heart_rate', label: 'Heart rate', unit: 'bpm' },
  { kind: 'respiratory_rate', label: 'Respiratory rate', unit: 'breaths/min' },
  { kind: 'temperature', label: 'Temperature', unit: '°C' },
  { kind: 'oxygen_saturation', label: 'Oxygen saturation', unit: '%' },
];

type VitalInputs = Record<EncounterVital['kind'], string>;
const emptyVitals = (): VitalInputs => ({ blood_pressure: '', heart_rate: '', respiratory_rate: '', temperature: '', oxygen_saturation: '' });

function latestVitalInputs(vitals: EncounterVital[] = []): VitalInputs {
  return vitals.reduce<VitalInputs>((values, vital) => ({ ...values, [vital.kind]: vital.value }), emptyVitals());
}

function noteBlocks(scan: RecentEmergencyScan): ResponderNoteBlock[] {
  if (scan.note?.blocks) return scan.note.blocks;
  return [
    ...(scan.note?.text ? [{ id: `${scan.id}-text`, type: 'text' as const, text: scan.note.text, createdAt: scan.note.updatedAt }] : []),
    ...(scan.note?.photoUris ?? []).map((uri, index) => ({ id: `${scan.id}-image-${index}`, type: 'image' as const, uri, createdAt: scan.note!.updatedAt })),
  ];
}

function digitsOnly(value: string, maxLength = 3): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

function decimalOnly(value: string): string {
  const normalized = value.replace(/[^\d.]/g, '');
  const [whole = '', ...fraction] = normalized.split('.');
  return `${whole.slice(0, 3)}${fraction.length ? `.${fraction.join('').slice(0, 1)}` : ''}`;
}

function BloodPressureFields({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [systolic = '', diastolic = ''] = value.split('/', 2);
  const update = (nextSystolic: string, nextDiastolic: string) => {
    onChange(nextSystolic || nextDiastolic ? `${nextSystolic}/${nextDiastolic}` : '');
  };

  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-1">
        <TextField
          label="Systolic"
          value={systolic}
          onChangeText={(next) => update(digitsOnly(next), diastolic)}
          keyboardType="number-pad"
          maxLength={3}
        />
      </View>
      <ThemedText type="heading">/</ThemedText>
      <View className="flex-1">
        <TextField
          label="Diastolic"
          value={diastolic}
          onChangeText={(next) => update(systolic, digitsOnly(next))}
          keyboardType="number-pad"
          maxLength={3}
        />
      </View>
      <ThemedText color="mutedForeground">mmHg</ThemedText>
    </View>
  );
}

export default function ResponderEncounterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { user } = useAuth();
  const isVerifiedProfessional = user?.permissions.includes('verified professional') ?? false;
  const [scan, setScan] = useState<RecentEmergencyScan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [observations, setObservations] = useState('');
  const [actionsTaken, setActionsTaken] = useState('');
  const [vitalInputs, setVitalInputs] = useState<VitalInputs>(emptyVitals);
  const [vitalsDirty, setVitalsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const noteFlushRef = useRef<(() => Promise<void>) | null>(null);
  const registerNoteFlush = useCallback((flush: () => Promise<void>) => { noteFlushRef.current = flush; }, []);

  useEffect(() => {
    let active = true;
    void historyRepo.getById(id).then((found) => {
      if (!active) return;
      if (!found) { setError('This scan is unavailable or has expired.'); return; }
      setScan(found);
      setObservations(found.encounter?.observations ?? '');
      setActionsTaken(found.encounter?.actionsTaken ?? '');
      setVitalInputs(latestVitalInputs(found.encounter?.vitals));
      setVitalsDirty(false);
    }).catch(() => { if (active) setError('Unable to open this scan.'); });
    return () => { active = false; };
  }, [id]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void historyRepo.getById(id).then((found) => { if (active && found) setScan(found); });
    return () => { active = false; };
  }, [id]));

  const save = async (): Promise<RecentEmergencyScan | null> => {
    if (!scan) return null;
    const authorName = user?.fullname.trim();
    const authorId = user?.id;
    if (!authorName || !authorId) { setError('Your signed-in account could not be identified. Sign in again and retry.'); return null; }
    const entered = vitalFields.filter((field) => vitalInputs[field.kind].trim());
    const validation = encounterVitalsSchema.safeParse(vitalInputs);
    if (!validation.success) { setError(validation.error.issues[0]?.message ?? 'Check the vital readings.'); return null; }
    setSaving(true);
    setError(null);
    try {
      await noteFlushRef.current?.();
      const now = new Date().toISOString();
      const verifiedBy = isVerifiedProfessional ? { userId: String(authorId), name: authorName } : undefined;
      const newVitals = vitalsDirty
        ? entered.map((field) => ({ kind: field.kind, value: vitalInputs[field.kind].trim(), unit: field.unit, measuredAt: now, recordedBy: authorName.slice(0, 120), verifiedBy }))
        : [];
      let encounter: ResponderEncounter = {
        authorName: authorName.slice(0, 120), authorIdentity: verifiedBy ? 'verified_professional' : 'self_declared', authorId: String(authorId), verifiedBy,
        observations: observations.trim().slice(0, 4000),
        actionsTaken: actionsTaken.trim().slice(0, 4000),
        recordedAt: scan.encounter?.recordedAt ?? now,
        updatedAt: now,
        vitals: [
          ...(scan.encounter?.vitals ?? []),
          ...newVitals,
        ],
      };
      const patientId = typeof scan.info.patientId === 'string' ? scan.info.patientId : String(scan.info.patientId ?? '');
      const existingVitalsForUpload = !scan.encounter?.cloudEncounterId
        ? scan.encounter?.vitals ?? []
        : scan.encounter.authorIdentity === 'verified_professional' && scan.encounter.authorId === verifiedBy?.userId
          ? scan.encounter.vitals
          : [];
      if (__DEV__) console.log('[Encounter] save requested', { isVerifiedProfessional, patientId: patientId || null, newVitalCount: newVitals.length, uploadVitalCount: existingVitalsForUpload.length + newVitals.length });
      if (verifiedBy && patientId) {
        const cloud = await saveProfessionalEncounter({ id: scan.encounter?.cloudEncounterId, patient_id: patientId, observations: encounter.observations, actions_taken: encounter.actionsTaken, vitals: [...existingVitalsForUpload, ...newVitals], recorded_at: encounter.recordedAt });
        if (__DEV__) console.log('[Encounter] saved to Supabase', { encounterId: cloud.id, patientId, vitalCount: cloud.vitals.length, updatedAt: cloud.updatedAt });
        encounter = { ...encounter, cloudEncounterId: cloud.id };
      } else if (__DEV__) {
        console.warn('[Encounter] Supabase save skipped', {
          reason: !verifiedBy ? 'signed-in account is not a verified professional' : 'scanned QR has no patient ID',
          isVerifiedProfessional,
          patientId: patientId || null,
        });
      }
      await historyRepo.setEncounter(scan.id, encounter);
      const updated = await historyRepo.getById(scan.id);
      if (!updated) throw new Error('Unable to reopen the saved encounter.');
      setScan(updated);
      setVitalsDirty(false);
      return updated;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save this encounter.');
      return null;
    } finally { setSaving(false); }
  };

  const exportReport = async () => {
    const updated = await save();
    if (!updated) return;
    setSharing(true);
    try { await shareResponderReport(updated); }
    catch (cause) { Alert.alert('Report unavailable', cause instanceof Error ? cause.message : 'Unable to share the report.'); }
    finally { setSharing(false); }
  };

  if (!isVerifiedProfessional) return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}><ThemedText type="heading">Verified professional access required</ThemedText><ThemedText color="mutedForeground">Only verified professionals can record and share encounter details or vital signs.</ThemedText><PrimaryButton label="Go back" onPress={() => router.back()} /></View>;
  if (!scan && !error) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={theme.primary} /></View>;
  if (!scan) return <View style={{ flex: 1, justifyContent: 'center', padding: 20, gap: 16 }}><ThemedText selectable>{error}</ThemedText><PrimaryButton label="Back" onPress={() => router.back()} /></View>;

  return <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }}>
    <Card><ThemedText selectable type="bodyBold">Patient-provided information</ThemedText><ThemedText selectable>{scan.info.name || 'Name not recorded'}</ThemedText><ThemedText selectable color="mutedForeground">Scanned {new Date(scan.scannedAt).toLocaleString()}. The emergency summary is a saved snapshot, not a clinical record.</ThemedText></Card>
    <ThemedText selectable type="heading">Encounter details</ThemedText>
    <ThemedText selectable color="mutedForeground">{isVerifiedProfessional ? 'This encounter will be attributed to your verified professional account and synchronized with the patient.' : 'This account is not a verified professional. The encounter can be saved on this device, but it will not be shared with the patient.'}</ThemedText>
    <Card className="gap-1">
      <ThemedText type="small" color="mutedForeground">Recorded by</ThemedText>
      <ThemedText type="bodyBold">{user?.fullname ?? 'Signed-in account'}</ThemedText>
    </Card>
    <Card>
      <ResponderMarkdownNote
        key={scan.id}
        embedded
        initialBlocks={noteBlocks(scan)}
        initialTitle={scan.note?.title ?? ''}
        registerFlush={registerNoteFlush}
        onSave={(blocks, title) => historyRepo.setNoteBlocks(scan.id, blocks, title)}
      />
    </Card>
    <TextField label="Clinical observations" value={observations} onChangeText={setObservations} multiline maxLength={4000} />
    <TextField label="Actions taken" value={actionsTaken} onChangeText={setActionsTaken} multiline maxLength={4000} />
    <ThemedText selectable type="heading">Vitals measured now</ThemedText>
    <ThemedText selectable color="mutedForeground">Enter readings measured during this encounter. Saved values stay in the fields so they remain easy to review.</ThemedText>
    {vitalFields.map((field) => field.kind === 'blood_pressure' ? (
      <BloodPressureFields
        key={field.kind}
        value={vitalInputs.blood_pressure}
        onChange={(value) => {
          setVitalsDirty(true);
          setVitalInputs((current) => ({ ...current, blood_pressure: value }));
        }}
      />
    ) : (
      <TextField
        key={field.kind}
        label={`${field.label} (${field.unit})`}
        value={vitalInputs[field.kind]}
        onChangeText={(value) => {
          setVitalsDirty(true);
          setVitalInputs((current) => ({
            ...current,
            [field.kind]: field.kind === 'temperature' ? decimalOnly(value) : digitsOnly(value),
          }));
        }}
        keyboardType={field.kind === 'temperature' ? 'decimal-pad' : 'number-pad'}
        maxLength={field.kind === 'temperature' ? 5 : 3}
      />
    ))}
    {error ? <ThemedText selectable style={{ color: theme.destructive }}>{error}</ThemedText> : null}
    <PrimaryButton label="Save encounter" loading={saving} disabled={saving || sharing} onPress={() => void save()} />
    <PrimaryButton label="Generate and share PDF report" variant="outline" loading={sharing} disabled={saving || sharing} onPress={() => void exportReport()} />
    <ThemedText selectable color="mutedForeground">{isVerifiedProfessional ? 'Saved locally and synchronized as a verified professional encounter. The patient receives updates through Supabase Realtime.' : 'Saved locally on this device. The scan and encounter expire seven days after the most recent scan; export the report before then.'}</ThemedText>
  </ScrollView>;
}
