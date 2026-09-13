import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmergencyView } from '@/components/emergency-view';
import { PrimaryButton } from '@/components/primary-button';
import { ResponderNoteCard } from '@/components/responder-note-card';
import { QrScannerView } from '@/components/qr-scanner-view';
import { ThemedText } from '@/components/themed-text';
import { resolveEmergencyCard } from '@/api/endpoints/emergency-wallet-card';
import { saveScan } from '@/db/repositories/recent-emergency-scans.repo';
import { useTheme } from '@/hooks/use-theme';
import { parseEmergencyCardReference, QR_V3_REFERENCE_PREFIX } from '@/lib/emergency-qr-reference';
import { parseEmergencyQr, type ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';
import type { QrVerificationResult } from '@/types/emergency';

export default function ResponderScanScreen() {
  const theme = useTheme();
  const { raw: initialRaw } = useLocalSearchParams<{ raw?: string }>();
  const insets = useSafeAreaInsets();
  const [result, setResult] = useState<{ info: ScannedEmergencyInfo; verification: QrVerificationResult; source: 'qr' | 'dynamic-card'; scanId?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const processing = useRef(false);
  const retryRaw = useRef<string | null>(null);

  const reset = () => {
    processing.current = false;
    setResult(null);
    setError(null);
    setTorch(false);
    setIsProcessing(false);
  };

  const closeResponderFlow = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)');
  };

  const handleScanned = async (raw: string) => {
    if (processing.current) return;
    processing.current = true;
    setIsProcessing(true);
    let snapshotRaw = raw;
    let source: 'qr' | 'dynamic-card' = 'qr';
    const cardToken = parseEmergencyCardReference(raw);
    if (raw.startsWith(QR_V3_REFERENCE_PREFIX) && !cardToken) {
      processing.current = false;
      setIsProcessing(false);
      setError('This dynamic emergency card is invalid or unavailable.');
      return;
    }
    if (cardToken) {
      const network = await NetInfo.fetch();
      if (!(network.isInternetReachable ?? network.isConnected)) {
        processing.current = false;
        setIsProcessing(false);
        setError('Printed card requires internet to retrieve the latest information. If available, scan the patient’s on-phone MediScan QR for offline access.');
        return;
      }
      try {
        let resolved;
        try { resolved = await resolveEmergencyCard(cardToken); } catch { await new Promise((resolve) => setTimeout(resolve, 350)); resolved = await resolveEmergencyCard(cardToken); }
        snapshotRaw = resolved.qr_payload;
        source = 'dynamic-card';
      } catch {
        processing.current = false;
        setIsProcessing(false);
        setError('This dynamic emergency card is invalid, revoked, or temporarily unavailable.');
        return;
      }
    }
    let parsed = await parseEmergencyQr(snapshotRaw);
    if (!parsed) {
      await new Promise((resolve) => setTimeout(resolve, 160));
      parsed = await parseEmergencyQr(snapshotRaw);
    }
    if (!parsed) {
      processing.current = false;
      setIsProcessing(false);
      setError(null);
      if (retryRaw.current !== raw) { retryRaw.current = raw; setTimeout(() => { retryRaw.current = null; void handleScanned(raw); }, 250); }
      return;
    }
    if (parsed.verification.status === 'invalid') {
      processing.current = false;
      setIsProcessing(false);
      setError(parsed.verification.message);
      return;
    }
    setResult({ ...parsed, source });
    setIsProcessing(false);
    void saveScan(raw, parsed.info, parsed.verification).then((scanId) => setResult((current) => current ? { ...current, scanId } : current)).catch(() => {
      // Emergency display must never depend on the optional retained-history write.
    });
  };

  useEffect(() => {
    if (typeof initialRaw === 'string' && initialRaw) void handleScanned(initialRaw);
  }, [initialRaw]);

  if (!result && !error) {
    return <><Stack.Screen options={{ headerShown: false }} /><View style={{ flex: 1, backgroundColor: '#000' }}>
      {!isProcessing ? <QrScannerView onScanned={handleScanned} fullscreen torchOn={torch} accentColor={theme.primary} /> : null}
      {isProcessing ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 90, alignItems: 'center' }}><ActivityIndicator size="large" color="#fff" /></View> : null}
      <View style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
        <Pressable accessibilityLabel="Close scanner" onPress={closeResponderFlow} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,.55)' }}><Ionicons name="close" size={24} color="#fff" /></Pressable>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Pressable accessibilityLabel={torch ? 'Turn torch off' : 'Turn torch on'} onPress={() => setTorch((value) => !value)} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,.55)' }}><Ionicons name={torch ? 'flash' : 'flash-outline'} size={22} color="#fff" /></Pressable>
          <Pressable accessibilityLabel="Open recent scans" onPress={() => router.push('/responder-history' as never)} style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,.55)' }}><Ionicons name="time-outline" size={24} color="#fff" /></Pressable>
        </View>
      </View>
    </View></>;
  }

  return <><Stack.Screen options={{
    headerShown: true,
    title: 'Emergency information',
    headerBackVisible: false,
    headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={closeResponderFlow} hitSlop={12} style={{ padding: 6 }}><Ionicons name="arrow-back" size={24} color={theme.foreground} /></Pressable>,
  }} /><ScrollView contentInsetAdjustmentBehavior="automatic" style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 24, gap: 16 }}>
    {error ? <View style={{ alignItems: 'center', gap: 16, paddingTop: 80 }}><Ionicons name="warning-outline" size={48} color={theme.destructive} /><ThemedText selectable type="heading" style={{ textAlign: 'center' }}>Unable to show emergency information</ThemedText><ThemedText selectable color="mutedForeground" style={{ textAlign: 'center' }}>{error}</ThemedText><PrimaryButton label="Scan again" onPress={reset} /></View> : null}
    {result ? <><EmergencyView info={result.info} verification={result.verification} source={result.source} /><ResponderNoteCard onPress={() => result.scanId && router.push({ pathname: '/responder-history/[id]/note', params: { id: result.scanId } })} /><PrimaryButton label="Scan another" variant="outline" onPress={reset} /></> : null}
  </ScrollView></>;
}

