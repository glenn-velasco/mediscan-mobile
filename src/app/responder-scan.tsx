import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/useAuth';
import { EmergencyScanContent } from '@/components/emergency-scan-content';
import { logEmergencyQrEvent } from '@/api/endpoints/analytics';
import { getProfessionalEncounters } from '@/api/endpoints/professional-scans';
import { PrimaryButton } from '@/components/primary-button';
import { QrScannerView } from '@/components/qr-scanner-view';
import { ThemedText } from '@/components/themed-text';
import { resolveEmergencyCard } from '@/api/endpoints/emergency-wallet-card';
import { resolvePatientHandoffReference } from '@/api/endpoints/patient-handoff';
import { saveScan, updateScanInfo } from '@/db/repositories/recent-emergency-scans.repo';
import { useTheme } from '@/hooks/use-theme';
import { parseEmergencyCardReference, QR_V3_REFERENCE_PREFIX } from '@/lib/emergency-qr-reference';
import { parseHybridEmergencyQr, QR_HYBRID_PREFIX } from '@/lib/emergency-qr-hybrid';
import { parsePatientHandoffFrame, parsePatientHandoffFrames, parsePatientHandoffReference, validatePatientHandoffInfo, type PatientHandoffFrame } from '@/lib/patient-handoff';
import { parseEmergencyQr, withLatestVerifiedEncounter, type ScannedEmergencyInfo } from '@/lib/parse-emergency-summary';
import { consumeUpdatedScannedInfo, setPendingManageInfo, setPendingManageInfoQrData } from '@/lib/manage-info-pending';
import type { QrVerificationResult } from '@/types/emergency';

export default function ResponderScanScreen() {
  const theme = useTheme();
  const { refreshUser } = useAuth();
  const { raw: initialRaw } = useLocalSearchParams<{ raw?: string }>();
  const insets = useSafeAreaInsets();
  const [result, setResult] = useState<{ info: ScannedEmergencyInfo; verification: QrVerificationResult; source: 'qr' | 'dynamic-card' | 'printable-offline'; scanId?: string; raw?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const processing = useRef(false);
  const retryRaw = useRef<string | null>(null);
  const scanGeneration = useRef(0);
  const liveEncounterRefreshes = useRef(new Set<string>());
  const handoffFrames = useRef<{ transferId: string; total: number; parts: Map<number, PatientHandoffFrame> } | null>(null);
  const [handoffProgress, setHandoffProgress] = useState<{ received: number; total: number } | null>(null);

  const reset = () => {
    scanGeneration.current++;
    processing.current = false;
    setResult(null);
    setError(null);
    setTorch(false);
    setIsProcessing(false);
    liveEncounterRefreshes.current.clear();
    handoffFrames.current = null;
    setHandoffProgress(null);
  };

  const refreshLatestEncounter = (info: ScannedEmergencyInfo, generation: number) => {
    if (info.patientId === null) return;
    const patientId = String(info.patientId);
    if (liveEncounterRefreshes.current.has(patientId)) return;
    liveEncounterRefreshes.current.add(patientId);
    void logEmergencyQrEvent({ action: 'scanned', patient_id: info.patientId, context: 'responder_scan' })
      .then(() => getProfessionalEncounters(patientId))
      .then((encounters) => {
        if (scanGeneration.current !== generation) return;
        setResult((current) => current && String(current.info.patientId) === patientId
          ? { ...current, info: withLatestVerifiedEncounter(current.info, encounters[0]) }
          : current);
      })
      .catch(() => {
        // Keep displaying the signed QR snapshot if live encounter access is unavailable.
      });
  };

  const closeResponderFlow = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)');
  };

  const handleScanned = async (raw: string) => {
    const frame = parsePatientHandoffFrame(raw);
    if (frame) {
      const current = handoffFrames.current;
      if (!current || current.transferId !== frame.transferId || current.total !== frame.total) {
        handoffFrames.current = { transferId: frame.transferId, total: frame.total, parts: new Map() };
      }
      const transfer = handoffFrames.current!;
      transfer.parts.set(frame.index, frame);
      setHandoffProgress({ received: transfer.parts.size, total: transfer.total });
      if (transfer.parts.size < transfer.total || processing.current) return;
      processing.current = true;
      setIsProcessing(true);
      const generation = ++scanGeneration.current;
      const parsed = await parsePatientHandoffFrames([...transfer.parts.values()]);
      if (!parsed) {
        processing.current = false;
        setIsProcessing(false);
        handoffFrames.current = null;
        setHandoffProgress(null);
        setError('The offline patient handoff was incomplete or damaged. Scan it again.');
        return;
      }
      const verification: QrVerificationResult = {
        status: 'legacy',
        authenticity: 'unverified',
        message: parsed.verification.message.replace('Forwarded snapshot', 'Offline hospital handoff'),
      };
      const scanId = await saveScan(`MEDISCAN:handoff:3-complete:${frame.transferId}`, parsed.info, verification, 'qr').catch(() => undefined);
      if (scanGeneration.current === generation) {
        setResult({ info: parsed.info, verification, source: 'qr', scanId });
        setIsProcessing(false);
        setHandoffProgress(null);
        refreshLatestEncounter(parsed.info, generation);
      }
      processing.current = false;
      return;
    }
    if (processing.current) return;
    processing.current = true;
    setIsProcessing(true);
    const generation = ++scanGeneration.current;
    const handoffToken = parsePatientHandoffReference(raw);
    if (raw.startsWith('MEDISCAN:handoff:2:') && !handoffToken) {
      processing.current = false;
      setIsProcessing(false);
      setError('This patient handoff QR is invalid.');
      return;
    }
    if (handoffToken) {
      const network = await NetInfo.fetch();
      if (!(network.isInternetReachable ?? network.isConnected)) {
        processing.current = false;
        setIsProcessing(false);
        setError('Connect to the internet to receive this hospital handoff.');
        return;
      }
      try {
        const handoff = await resolvePatientHandoffReference(handoffToken);
        const info = validatePatientHandoffInfo(handoff.info);
        if (!info) throw new Error('The patient handoff is damaged.');
        const verification: QrVerificationResult = {
          status: 'valid',
          authenticity: 'server_verified',
          message: `Hospital handoff from ${handoff.shared_by} at ${handoff.shared_at}. Access was verified and logged.`,
        };
        const scanId = await saveScan(raw, info, verification, 'qr').catch(() => undefined);
        if (scanGeneration.current === generation) {
          setResult({ info, verification, source: 'qr', scanId });
          setIsProcessing(false);
          refreshLatestEncounter(info, generation);
        }
      } catch (cause) {
        if (scanGeneration.current === generation) {
          const message = cause instanceof Error ? cause.message.replace(/\s*\(HTTP \d+\)$/, '') : 'Unable to receive this patient handoff.';
          setError(message);
          setIsProcessing(false);
        }
      }
      processing.current = false;
      return;
    }
    if (raw.startsWith(QR_HYBRID_PREFIX)) {
      const hybrid = await parseHybridEmergencyQr(raw);
      if (!hybrid) {
        processing.current = false;
        setIsProcessing(false);
        setError('This printed QR is invalid or damaged.');
        return;
      }
      setResult({ info: hybrid.info, verification: hybrid.verification, source: 'printable-offline' });
      refreshLatestEncounter(hybrid.info, generation);
      setIsProcessing(false);
      void saveScan(raw, hybrid.info, hybrid.verification, 'printable-offline').then((scanId) => {
        if (scanGeneration.current === generation) setResult((current) => current?.source === 'printable-offline' ? { ...current, scanId } : current);
      }).catch(() => {});
      // Offline information is displayed before any network call. A failed lookup never removes it.
      void (async () => {
        try {
          const network = await NetInfo.fetch();
          if (!(network.isInternetReachable ?? network.isConnected)) return;
          const resolved = await resolveEmergencyCard(hybrid.token);
          const latest = await parseEmergencyQr(resolved.qr_payload);
          if (!latest || latest.verification.status === 'invalid' || scanGeneration.current !== generation) {
            if (scanGeneration.current === generation) setResult((current) => current ? {
              ...current,
              verification: { ...current.verification, message: `${current.verification.message} The published copy could not be read; showing the printed snapshot.` },
            } : current);
            return;
          }
          const printedAt = Date.parse(hybrid.info.lastUpdatedAt || hybrid.info.generatedAt);
          const onlineAt = Date.parse(latest.info.lastUpdatedAt || latest.info.generatedAt);
          if (onlineAt < printedAt) {
            setResult((current) => current ? {
              ...current,
              verification: { ...current.verification, message: `${current.verification.message} The online copy is older than this printout; showing the printed snapshot.` },
            } : current);
            return;
          }
          latest.info.recentHistory = resolved.recent_history ?? [];
          // Keep the printed scan in history as a distinct observation of what was physically shown.
          const scanId = await saveScan(resolved.qr_payload, latest.info, latest.verification, 'dynamic-card').catch(() => undefined);
          if (scanGeneration.current === generation) {
            setResult({ ...latest, source: 'dynamic-card', scanId });
            refreshLatestEncounter(latest.info, generation);
          }
        } catch (error) {
          const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : null;
          console.warn('[Wallet card] Online lookup failed', { status });
          const explanation = status === 404
            ? 'No published online copy was found for this card. It may be unpublished or revoked; showing the printed snapshot.'
            : status === 401 || status === 403
              ? 'Online lookup was rejected; showing the printed snapshot.'
              : 'Could not check the online copy; showing the printed snapshot.';
          if (scanGeneration.current === generation) setResult((current) => current ? {
            ...current,
            verification: { ...current.verification, message: explanation },
          } : current);
        }
      })();
      return;
    }
    let snapshotRaw = raw;
    let source: 'qr' | 'dynamic-card' = 'qr';
    let serverHistory: Awaited<ReturnType<typeof resolveEmergencyCard>>['recent_history'];
    const cardToken = parseEmergencyCardReference(raw);
    if (raw.startsWith(QR_V3_REFERENCE_PREFIX) && !cardToken) {
      processing.current = false;
      setIsProcessing(false);
      setError('This printed QR is invalid or unavailable.');
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
        serverHistory = resolved.recent_history;
      } catch {
        processing.current = false;
        setIsProcessing(false);
        setError('This printed QR is invalid, revoked, or temporarily unavailable.');
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
    if (source === 'dynamic-card') parsed.info.recentHistory = serverHistory ?? [];
    setResult({ ...parsed, source, raw: snapshotRaw });
    refreshLatestEncounter(parsed.info, generation);
    setIsProcessing(false);
    void saveScan(raw, parsed.info, parsed.verification, source).then((scanId) => setResult((current) => current ? { ...current, scanId } : current)).catch(() => {
      // Emergency display must never depend on the optional retained-history write.
    });
  };

  useEffect(() => {
    void refreshUser().catch(() => {});
  }, [refreshUser]);

  useFocusEffect(
    useCallback(() => {
      const updated = consumeUpdatedScannedInfo();
      if (updated) {
        setResult((current) => (current ? { ...current, info: updated } : current));
        if (result?.scanId) {
          void updateScanInfo(result.scanId, updated);
        }
      }
    }, [result?.scanId]),
  );

  const handleManageInfo = () => {
    if (!result || result.info.patientId === null) return;
    const rawData = result.raw ?? (typeof initialRaw === 'string' ? initialRaw : '');
    setPendingManageInfo({ qrData: rawData, info: result.info });
    setPendingManageInfoQrData(rawData);
    router.push({
      pathname: '/manage-info',
      params: {
        patientId: String(result.info.patientId),
        ...(result.scanId ? { scanId: result.scanId } : {}),
      },
    });
  };

  useEffect(() => {
    if (typeof initialRaw === 'string' && initialRaw) void handleScanned(initialRaw);
  }, [initialRaw]);

  useEffect(() => () => { scanGeneration.current++; }, []);

  if (!result && !error) {
    return <><Stack.Screen options={{ headerShown: false }} /><View style={{ flex: 1, backgroundColor: '#000' }}>
      {!isProcessing ? <QrScannerView onScanned={handleScanned} fullscreen continuous torchOn={torch} accentColor={theme.primary} /> : null}
      {isProcessing ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: 90, alignItems: 'center' }}><ActivityIndicator size="large" color="#fff" /></View> : null}
      {handoffProgress && !isProcessing ? <View style={{ position: 'absolute', left: 24, right: 24, bottom: 72, alignItems: 'center', borderRadius: 14, padding: 14, backgroundColor: 'rgba(0,0,0,.72)' }}><ThemedText type="bodyBold" style={{ color: '#fff' }}>Receiving patient handoff {handoffProgress.received}/{handoffProgress.total}</ThemedText><ThemedText type="small" style={{ color: 'rgba(255,255,255,.8)', textAlign: 'center' }}>Keep the camera pointed at the animated QR.</ThemedText></View> : null}
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
  }} /><ScrollView contentInsetAdjustmentBehavior="automatic" nestedScrollEnabled showsVerticalScrollIndicator={false} style={{ flex: 1, backgroundColor: theme.background }} contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: insets.bottom + 40, gap: 16 }}>
    {error ? <View style={{ alignItems: 'center', gap: 16, paddingTop: 80 }}><Ionicons name="warning-outline" size={48} color={theme.destructive} /><ThemedText selectable type="heading" style={{ textAlign: 'center' }}>Unable to show emergency information</ThemedText><ThemedText selectable color="mutedForeground" style={{ textAlign: 'center' }}>{error}</ThemedText><PrimaryButton label="Scan again" onPress={reset} /></View> : null}
    {result ? (
      <EmergencyScanContent
        info={result.info}
        scanId={result.scanId}
        verification={result.verification}
        source={result.source}
        encounterReady={Boolean(result.scanId)}
        onRecordEncounter={() => result.scanId && router.push({ pathname: '/responder-history/[id]/encounter', params: { id: result.scanId } })}
        onManageInfo={result.info.patientId !== null ? handleManageInfo : undefined}
      />
    ) : null}
  </ScrollView></>;
}

