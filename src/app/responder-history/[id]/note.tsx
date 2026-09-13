import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { ResponderMarkdownNote } from '@/components/responder-markdown-note';
import { ThemedText } from '@/components/themed-text';
import * as historyRepo from '@/db/repositories/recent-emergency-scans.repo';
import type { RecentEmergencyScan, ResponderNoteBlock } from '@/types/emergency';

function noteBlocks(item: RecentEmergencyScan): ResponderNoteBlock[] {
  if (item.note?.blocks) return item.note.blocks;
  return [
    ...(item.note?.text ? [{ id: `${item.id}-text`, type: 'text' as const, text: item.note.text, createdAt: item.note.updatedAt }] : []),
    ...(item.note?.photoUris ?? []).map((uri, index) => ({ id: `${item.id}-image-${index}`, type: 'image' as const, uri, createdAt: item.note!.updatedAt })),
  ];
}

export default function ResponderNoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<RecentEmergencyScan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(async () => {
      if (!active) return;
      const found = await historyRepo.getById(id);
      if (!found) { setError('This saved scan is unavailable or has expired.'); return; }
      setItem(found);
    });
    return () => { active = false; };
  }, [id]);

  if (error) return <View style={{ flex: 1, backgroundColor: '#0b1011', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}><ThemedText selectable type="heading">Note unavailable</ThemedText><ThemedText selectable>{error}</ThemedText></View>;
  if (!item) return <View style={{ flex: 1, backgroundColor: '#0b1011', alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#25b8b0" /></View>;

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#0b1011' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}><ScrollView contentInsetAdjustmentBehavior="automatic" automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} contentContainerStyle={{ padding: 20, paddingBottom: 220, gap: 16 }}><ResponderMarkdownNote initialBlocks={noteBlocks(item)} initialTitle={item.note?.title ?? ''} onSave={async (blocks, title) => { await historyRepo.setNoteBlocks(item.id, blocks, title); setItem(await historyRepo.getById(item.id)); }} /></ScrollView></KeyboardAvoidingView>;
}
