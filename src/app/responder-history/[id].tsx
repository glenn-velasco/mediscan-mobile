import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as LocalAuthentication from 'expo-local-authentication';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';

import { EmergencyScanContent } from '@/components/emergency-scan-content';
import { AccessGate } from '@/components/access-gate';
import { PrimaryButton } from '@/components/primary-button';
import { ResponderNoteCard } from '@/components/responder-note-card';
import { ThemedText } from '@/components/themed-text';
import * as historyRepo from '@/db/repositories/recent-emergency-scans.repo';
import { useTheme } from '@/hooks/use-theme';
import { useImagePreview } from '@/hooks/use-image-preview';
import type { RecentEmergencyScan } from '@/types/emergency';
import { grantRecentScanAccess, hasRecentScanAccess } from '@/services/recent-scan-access';

export default function SavedScanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [item, setItem] = useState<RecentEmergencyScan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const preview = useImagePreview();

  useEffect(() => {
    let active = true;
    void (hasRecentScanAccess() ? Promise.resolve({ success: true }) : LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock saved emergency scan', fallbackLabel: 'Use device passcode', disableDeviceFallback: false })).then(async (auth) => {
      if (!active) return;
      if (!auth.success) { setError('Authentication is required to reopen this scan.'); return; }
      grantRecentScanAccess();
      const found = await historyRepo.getById(id);
      if (!active) return;
      if (!found) { setError('This saved scan is unavailable or has expired.'); return; }
      setItem(found);
      setAuthorized(true);
    });
    return () => { active = false; };
  }, [id]);

  useFocusEffect(useCallback(() => {
    if (!authorized) return;
    let active = true;
    const refresh = () => { void historyRepo.getById(id).then((found) => { if (active && found) setItem(found); }); };
    refresh();
    const timer = setTimeout(refresh, 900);
    return () => { active = false; clearTimeout(timer); };
  }, [authorized, id]));

  if (error) return <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}><ThemedText selectable type="heading">Saved scan unavailable</ThemedText><ThemedText selectable color="mutedForeground">{error}</ThemedText><PrimaryButton label="Go back" onPress={() => router.back()} /></View>;
  if (!item) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator color={theme.primary} /></View>;
  const previewImages = item.note?.blocks?.length
    ? item.note.blocks.filter((block): block is Extract<typeof block, { type: 'image' }> => block.type === 'image').map((block) => block.uri)
    : item.note?.photoUris ?? [];
  const previewIndex = preview.uri ? previewImages.indexOf(preview.uri) : -1;

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}><ScrollView style={{ flex: 1 }} contentInsetAdjustmentBehavior="automatic" nestedScrollEnabled showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} contentContainerStyle={{ flexGrow: 1, padding: 20, paddingBottom: 40, gap: 18 }}>
    <EmergencyScanContent
      info={item.info}
      scanId={item.id}
      verification={item.verification}
      source={item.source}
      savedSnapshot
      onDeleteSavedScan={() => Alert.alert('Delete saved scan?', 'This permanently deletes the snapshot and its local note.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void historyRepo.remove(item.id).then(() => router.back()) }])}
    />
    <AccessGate permissions={['verified professional']}>
      <ResponderNoteCard note={item.note} onImagePress={preview.open} />
    </AccessGate>
  </ScrollView>
    <Modal visible={Boolean(preview.uri)} transparent animationType="fade" onRequestClose={preview.close}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' }}>
        {preview.uri ? <Image source={{ uri: preview.uri }} contentFit="contain" style={{ width: '92%', height: '72%' }} /> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Close image preview" onPress={preview.close} style={{ position: 'absolute', top: 56, right: 20, width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={25} color="#fff" /></Pressable>
        {previewImages.length > 1 ? <View style={{ position: 'absolute', bottom: 48, flexDirection: 'row', gap: 70 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous image" disabled={previewIndex <= 0} onPress={() => preview.open(previewImages[previewIndex - 1])}><Ionicons name="chevron-back-circle" size={48} color={previewIndex > 0 ? '#fff' : '#666'} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Next image" disabled={previewIndex < 0 || previewIndex >= previewImages.length - 1} onPress={() => preview.open(previewImages[previewIndex + 1])}><Ionicons name="chevron-forward-circle" size={48} color={previewIndex >= 0 && previewIndex < previewImages.length - 1 ? '#fff' : '#666'} /></Pressable>
        </View> : null}
      </View>
    </Modal>
  </KeyboardAvoidingView>;
}




























