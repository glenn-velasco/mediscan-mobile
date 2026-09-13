import * as LocalAuthentication from 'expo-local-authentication';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from 'react-native';

import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import * as historyRepo from '@/db/repositories/recent-emergency-scans.repo';
import { useTheme } from '@/hooks/use-theme';
import { formatIsoDateTime } from '@/lib/format-date';
import type { RecentEmergencyScan } from '@/types/emergency';
import { GenderLabel, type Gender } from '@/constants/gender';
import { grantRecentScanAccess } from '@/services/recent-scan-access';

export default function RecentScansScreen() {
  const theme = useTheme();
  const [status, setStatus] = useState<'locked' | 'loading' | 'ready' | 'unavailable'>('locked');
  const [items, setItems] = useState<RecentEmergencyScan[]>([]);

  const unlock = useCallback(async () => {
    setStatus('loading');
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock recent emergency scans', fallbackLabel: 'Use device passcode', disableDeviceFallback: false });
    if (!result.success) {
      const unavailable = result.error === 'not_available' || result.error === 'not_enrolled' || result.error === 'passcode_not_set';
      setStatus(unavailable ? 'unavailable' : 'locked');
      return;
    }
    grantRecentScanAccess();
    setItems(await historyRepo.getAll());
    setStatus('ready');
  }, []);

  useFocusEffect(useCallback(() => { if (status === 'ready') void historyRepo.getAll().then(setItems); }, [status]));

  if (status !== 'ready') return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
    {status === 'loading' ? <ActivityIndicator color={theme.primary} /> : <><ThemedText selectable type="heading">Recent scans are protected</ThemedText><ThemedText selectable color="mutedForeground" style={{ textAlign: 'center' }}>{status === 'unavailable' ? 'Set up a device passcode or biometrics to retain and reopen emergency scans.' : 'Use your device credential to view saved emergency information and local notes.'}</ThemedText>{status !== 'unavailable' ? <PrimaryButton label="Unlock recent scans" onPress={() => void unlock()} /> : null}</>}
  </ScrollView>;

  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 20, gap: 12 }}>
    <ThemedText selectable type="bodyBold">Who I scanned</ThemedText>
    <ThemedText selectable color="mutedForeground">Encrypted on this device and deleted automatically seven days after the most recent scan.</ThemedText>
    {items.length === 0 ? <Card><ThemedText selectable color="mutedForeground">No recent emergency scans.</ThemedText></Card> : items.map((item) => {
      const critical = item.info.noBloodTransfusion === 'Yes' || item.info.allergies.some((a) => a.severity === 'severe' || a.severity === 'life-threatening');
      const gender = item.info.gender?.trim();
      const genderLabel = gender ? (GenderLabel[gender as Gender] ?? gender) : 'Not recorded';
      return <Pressable key={item.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/responder-history/[id]', params: { id: item.id } })}><Card><View style={{ gap: 4 }}><ThemedText selectable type="bodyBold">{item.info.name || 'Identity not recorded'}</ThemedText><ThemedText selectable color="mutedForeground">Gender: {genderLabel}</ThemedText><ThemedText selectable color="mutedForeground">Scanned {formatIsoDateTime(item.scannedAt)}</ThemedText>{critical ? <ThemedText selectable style={{ color: theme.destructive }}>Critical alert present</ThemedText> : null}<ThemedText selectable color="mutedForeground">Viewed {item.scanCount} {item.scanCount === 1 ? 'time' : 'times'}</ThemedText></View></Card></Pressable>;
    })}
    {items.length ? <PrimaryButton label="Clear all recent scans" variant="danger" onPress={() => Alert.alert('Clear recent scans?', 'This permanently deletes all saved snapshots and notes on this device.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear all', style: 'destructive', onPress: () => void historyRepo.clearAll().then(() => setItems([])) }])} /> : null}
  </ScrollView>;
}
