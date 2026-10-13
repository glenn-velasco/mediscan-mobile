import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuth } from '@/auth/useAuth';
import { PrimaryButton } from '@/components/primary-button';
import { QrCodeView } from '@/components/qr-code-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { createPatientHandoff } from '@/lib/patient-handoff';
import type { ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';
import { getById } from '@/db/repositories/recent-emergency-scans.repo';
import { generateResponderReport, loadNotePhotos } from '@/services/responder-report.service';

const escape = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function renderValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not recorded';
  if (Array.isArray(value)) return value.length ? value.map(renderValue).join('<hr>') : 'Not recorded';
  if (typeof value === 'object') return Object.entries(value).map(([key, entry]) => `<p><b>${escape(key.replace(/([A-Z])/g, ' $1'))}:</b> ${renderValue(entry)}</p>`).join('');
  return escape(String(value));
}

export function PatientHandoffShare({ info, scanId }: { info: ScannedEmergencyInfo; scanId?: string }) {
  const { user } = useAuth();
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [qrValue, setQrValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sharePdf = async (uri: string) => {
    if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is unavailable on this device.');
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Patient handoff report' });
  };

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try { await action(); } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to prepare handoff.';
      Alert.alert('Unable to share', message);
    }
    finally { setBusy(false); }
  };
  return <>
    <PrimaryButton label="Share" loading={busy} disabled={busy} onPress={() => { setOpen(true); setQrValue(null); }} />
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => !busy && setOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.45)' }}>
      <Pressable accessibilityLabel="Dismiss share menu" style={{ flex: 1 }} disabled={busy} onPress={() => setOpen(false)} />
      <ScrollView style={{ flexGrow: 0, maxHeight: '85%', backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24 }} contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 12 }}>
        <ThemedText type="heading">{qrValue ? 'Show QR' : 'Share'}</ThemedText>
        {!qrValue ? <>
        <PrimaryButton label="Show QR" disabled={busy} onPress={() => void run(async () => {
          setQrValue(await createPatientHandoff(info, user?.fullname || 'Responder'));
        })} />
        <PrimaryButton label="Generate Report" loading={busy} disabled={busy} onPress={() => { setOpen(false); void run(async () => {
          const saved = scanId ? await getById(scanId) : null;
          if (saved?.encounter) { await sharePdf(await generateResponderReport({ ...saved, info })); return; }
          const photos = saved ? await loadNotePhotos(saved) : [];
          const noteText = saved?.note?.blocks ? saved.note.blocks.filter((block) => block.type === 'text').map((block) => block.text).join('\n\n') : saved?.note?.text;
          const { uri } = await Print.printToFileAsync({ html: `<html><head><meta charset="utf-8"><style>body{font-family:Arial;padding:24px;color:#172425}p{margin:6px 0}hr{border:0;border-top:1px solid #ddd}img{max-width:100%;max-height:600px}</style></head><body><h1>MediScan patient handoff</h1><p>Forwarded snapshot. Confirm clinical details with the care team.</p><p>Prepared by ${escape(user?.fullname || 'Responder')} at ${escape(new Date().toISOString())}</p>${renderValue(info)}${noteText ? `<h2>Responder notes</h2><p>${escape(noteText)}</p>` : ''}${photos.map((photo) => `<figure><img src="${photo.dataUri}"/><figcaption>${escape(photo.addedAt || '')}</figcaption></figure>`).join('')}</body></html>` });
          await sharePdf(uri);
        }); }} />
        </> : <View style={{ alignItems: 'center', gap: 12 }}><ThemedText>{info.name}</ThemedText><QrCodeView value={qrValue} size={Math.min(width - 48, 360)} /><ThemedText color="mutedForeground" style={{ textAlign: 'center' }}>Scan once with MediScan on the receiving device. No internet is required.</ThemedText></View>}
        <PrimaryButton label="Close" variant="outline" disabled={busy} onPress={() => setOpen(false)} />
      </ScrollView>
      </View>
    </Modal>
  </>;
}
