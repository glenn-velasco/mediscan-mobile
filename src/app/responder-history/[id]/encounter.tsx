import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, View } from 'react-native';

import { Card } from '@/components/card';
import { TextField } from '@/components/form/text-field';
import { PrimaryButton } from '@/components/primary-button';
import { ResponderMarkdownNote } from '@/components/responder-markdown-note';
import { ThemedText } from '@/components/themed-text';
import * as historyRepo from '@/db/repositories/recent-emergency-scans.repo';
import { useTheme } from '@/hooks/use-theme';
import { shareResponderReport } from '@/services/responder-report.service';
import type { EncounterVital, RecentEmergencyScan, ResponderEncounter, ResponderNoteBlock } from '@/types/emergency';

const vitalFields: { kind: EncounterVital['kind']; label: string; unit: string }[] = [
  { kind: 'blood_pressure', label: 'Blood pressure (e.g. 120/80)', unit: 'mmHg' },
  { kind: 'heart_rate', label: 'Heart rate', unit: 'bpm' },
  { kind: 'respiratory_rate', label: 'Respiratory rate', unit: 'breaths/min' },
  { kind: 'temperature', label: 'Temperature', unit: '°C' },
  { kind: 'oxygen_saturation', label: 'Oxygen saturation', unit: '%' },
];

type VitalInputs = Record<EncounterVital['kind'], string>;
const emptyVitals = (): VitalInputs => ({ blood_pressure: '', heart_rate: '', respiratory_rate: '', temperature: '', oxygen_saturation: '' });

function noteBlocks(scan: RecentEmergencyScan): ResponderNoteBlock[] {
  if (scan.note?.blocks) return scan.note.blocks;
  return [
    ...(scan.note?.text ? [{ id: `${scan.id}-text`, type: 'text' as const, text: scan.note.text, createdAt: scan.note.updatedAt }] : []),
    ...(scan.note?.photoUris ?? []).map((uri, index) => ({ id: `${scan.id}-image-${index}`, type: 'image' as const, uri, createdAt: scan.note!.updatedAt })),
  ];
}

function isValidVital(kind: EncounterVital['kind'], value: string): boolean {
  return kind === 'blood_pressure' ? /^\d{2,3}\/\d{2,3}$/.test(value) : /^\d{1,3}(?:\.\d)?$/.test(value);
}

export default function ResponderEncounterScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [scan, setScan] = useState<RecentEmergencyScan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState('');
  const [observations, setObservations] = useState('');
  const [actionsTaken, setActionsTaken] = useState('');
  const [vitalInputs, setVitalInputs] = useState<VitalInputs>(emptyVitals);
  const [busy, setBusy] = useState(false);
  const noteFlushRef = useRef<(() => Promise<void>) | null>(null);
  const registerNoteFlush = useCallback((flush: () => Promise<void>) => { noteFlushRef.current = flush; }, []);

  useEffect(() => {
    let active = true;
    void historyRepo.getById(id).then((found) => {
      if (!active) return;
      if (!found) { setError('This scan is unavailable or has expired.'); return; }
      setScan(found);
      setAuthorName(found.encounter?.authorName ?? '');
      setObservations(found.encounter?.observations ?? '');
      setActionsTaken(found.encounter?.actionsTaken ?? '');
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
    if (!authorName.trim()) { setError('Enter the name of the person recording this encounter.'); return null; }
    const entered = vitalFields.filter((field) => vitalInputs[field.kind].trim());
    const invalid = entered.find((field) => !isValidVital(field.kind, vitalInputs[field.kind].trim()));
    if (invalid) { setError(`Check the ${invalid.label.toLowerCase()} value.`); return null; }
    setBusy(true);
    setError(null);
    try {
      await noteFlushRef.current?.();
      const now = new Date().toISOString();
      const encounter: ResponderEncounter = {
        authorName: authorName.trim().slice(0, 120), authorIdentity: 'self_declared',
        observations: observations.trim().slice(0, 4000),
        actionsTaken: actionsTaken.trim().slice(0, 4000),
        recordedAt: scan.encounter?.recordedAt ?? now,
        updatedAt: now,
        vitals: [
          ...(scan.encounter?.vitals ?? []),
          ...entered.map((field) => ({ kind: field.kind, value: vitalInputs[field.kind].trim(), unit: field.unit, measuredAt: now, recordedBy: authorName.trim().slice(0, 120) })),
        ],
      };
      await historyRepo.setEncounter(scan.id, encounter);
      const updated = await historyRepo.getById(scan.id);
      if (!updated) throw new Error('Unable to reopen the saved encounter.');
      setScan(updated);
      setVitalInputs(emptyVitals());
      return updated;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save this encounter.');
      return null;
    } finally { setBusy(false); }
  };

  const exportReport = async () => {
    const updated = await save();
    if (!updated) return;
    setBusy(true);
    try { await shareResponderReport(updated); }
    catch (cause) { Alert.alert('Report unavailable', cause instanceof Error ? cause.message : 'Unable to share the report.'); }
    finally { setBusy(false); }
  };

  if (!scan && !error) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={theme.primary} /></View>;
  if (!scan) return <View style={{ flex: 1, justifyContent: 'center', padding: 20, gap: 16 }}><ThemedText selectable>{error}</ThemedText><PrimaryButton label="Back" onPress={() => router.back()} /></View>;

  return <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }}>
    <Card><ThemedText selectable type="bodyBold">Patient-provided information</ThemedText><ThemedText selectable>{scan.info.name || 'Name not recorded'}</ThemedText><ThemedText selectable color="mutedForeground">Scanned {new Date(scan.scannedAt).toLocaleString()}. The emergency summary is a saved snapshot, not a clinical record.</ThemedText></Card>
    <ThemedText selectable type="heading">Encounter details</ThemedText>
    <ThemedText selectable color="mutedForeground">Only enter what you observed or did. Enter your name as you want it to appear on the report.</ThemedText>
    <TextField label="Your name" value={authorName} onChangeText={setAuthorName} autoCapitalize="words" maxLength={120} />
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
    {observations ? <Card><ThemedText selectable type="small" color="mutedForeground">Earlier observations from a previous report</ThemedText><ThemedText selectable>{observations}</ThemedText></Card> : null}
    <TextField label="Actions taken" value={actionsTaken} onChangeText={setActionsTaken} multiline maxLength={4000} />
    <ThemedText selectable type="heading">Vitals measured now</ThemedText>
    <ThemedText selectable color="mutedForeground">Enter only readings measured during this encounter. Saving records the current time; previous readings remain listed below.</ThemedText>
    {vitalFields.map((field) => <TextField key={field.kind} label={`${field.label} (${field.unit})`} value={vitalInputs[field.kind]} onChangeText={(value) => setVitalInputs((current) => ({ ...current, [field.kind]: value }))} keyboardType="decimal-pad" maxLength={12} />)}
    {scan.encounter?.vitals.map((vital, index) => <Card key={`${vital.measuredAt}-${index}`}><ThemedText selectable>{vital.kind.replace(/_/g, ' ')}: {vital.value} {vital.unit}</ThemedText><ThemedText selectable color="mutedForeground">Recorded {new Date(vital.measuredAt).toLocaleString()} by {vital.recordedBy}</ThemedText></Card>)}
    {error ? <ThemedText selectable style={{ color: theme.destructive }}>{error}</ThemedText> : null}
    <PrimaryButton label="Save encounter" loading={busy} disabled={busy} onPress={() => void save()} />
    <PrimaryButton label="Generate and share PDF report" variant="outline" loading={busy} disabled={busy} onPress={() => void exportReport()} />
    <ThemedText selectable color="mutedForeground">Saved locally on this device. The scan and encounter expire seven days after the most recent scan; export the report before then.</ThemedText>
  </ScrollView>;
}
