import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { InputAccessoryView, Modal, Platform, Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { blocksToMarkdown, markdownToBlocks } from '@/lib/responder-note-markdown';
import type { ResponderNoteBlock } from '@/types/emergency';

export function ResponderMarkdownNote({ initialBlocks, initialTitle = '', onSave }: { initialBlocks: ResponderNoteBlock[]; initialTitle?: string; onSave: (blocks: ResponderNoteBlock[], title: string) => Promise<void> }) {
  const theme = useTheme();
  const initialImages = useMemo(() => new Map(initialBlocks.filter((b): b is Extract<ResponderNoteBlock, { type: 'image' }> => b.type === 'image').map((b) => [b.id, b.uri])), [initialBlocks]);
  const [markdown, setMarkdown] = useState(() => blocksToMarkdown(initialBlocks));
  const [title, setTitle] = useState(initialTitle);
  const [images, setImages] = useState(initialImages);
  const [selection, setSelection] = useState({ start: markdown.length, end: markdown.length });
  const [activeTextId, setActiveTextId] = useState<string | null>(initialBlocks.find((b) => b.type === 'text')?.id ?? null);
  const [chooser, setChooser] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState('Saved just now');
  const didMount = useRef(false);
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const latestRef = useRef({ markdown, title, images });
  latestRef.current = { markdown, title, images };
  const parsed = markdownToBlocks(markdown, images);
  const imageBlocks = parsed.filter((b): b is Extract<ResponderNoteBlock, { type: 'image' }> => b.type === 'image');

  useEffect(() => {
    if (!didMount.current) { didMount.current = true; return; }
    setSaveStatus('Unsaved changes');
    const timer = setTimeout(() => { setSaveStatus('Saving…'); void onSaveRef.current(markdownToBlocks(markdown, images), title).then(() => setSaveStatus('Saved just now')); }, 700);
    return () => clearTimeout(timer);
  }, [markdown, title, images]);

  useEffect(() => () => {
    const latest = latestRef.current;
    void onSaveRef.current(markdownToBlocks(latest.markdown, latest.images), latest.title);
  }, []);

  const add = async (source: 'camera' | 'library') => {
    setChooser(false);
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8 });
    if (result.canceled) return;
    const additions = new Map(images);
    const tokens = result.assets.map((asset, index) => {
      const id = `image-${Date.now()}-${index}`;
      additions.set(id, asset.uri);
      return `![Patient image](mediscan-image:${id})`;
    }).join('\n\n');
    setImages(additions);
    const blocks = markdownToBlocks(markdown, images);
    const activeIndex = Math.max(0, blocks.findIndex((block) => block.id === activeTextId));
    const active = blocks[activeIndex];
    if (active?.type === 'text') {
      const before = active.text.slice(0, selection.start);
      const after = active.text.slice(selection.end);
      const insertedIds = Array.from(additions.keys()).slice(-result.assets.length);
      const inserted = result.assets.map((asset, index) => ({ id: insertedIds[index], type: 'image' as const, uri: asset.uri, createdAt: new Date().toISOString() }));
      const nextBlocks = [...blocks.slice(0, activeIndex), ...(before ? [{ ...active, text: before }] : []), ...inserted, ...(after ? [{ ...active, text: after }] : []), ...blocks.slice(activeIndex + 1)];
      setImages(additions);
      setMarkdown(blocksToMarkdown(nextBlocks));
      return;
    }
    setImages(additions);
    setMarkdown(`${markdown}${markdown ? '\n\n' : ''}${tokens}`);
  };

  const removeImage = (id: string) => {
    setMarkdown((value) => value.replace(new RegExp(`!\\[[^\\]]*\\]\\(mediscan-image:${id}\\)\\s*`, 'g'), '').trim());
    setImages((value) => { const next = new Map(value); next.delete(id); return next; });
    setViewerId(null);
  };

  const updateTextBlock = (id: string, text: string) => {
    const nextBlocks = parsed.map((block) => block.id === id && block.type === 'text' ? { ...block, text } : block);
    setMarkdown(blocksToMarkdown(nextBlocks));
  };

  return <View style={{ flex: 1, gap: 10 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Pressable accessibilityLabel="Back" onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.foreground} /></Pressable><View style={{ flexDirection: 'row', gap: 8 }}><Pressable accessibilityLabel="Pin note" style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="pin-outline" size={18} color={theme.foreground} /></Pressable><Pressable accessibilityLabel="More note options" style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="ellipsis-vertical" size={18} color={theme.foreground} /></Pressable></View></View>
    <ThemedText type="overline">Responder note</ThemedText>
    <ThemedText selectable color="mutedForeground">Markdown note · private to this device</ThemedText>
    <View style={{ flex: 1, minHeight: 300, paddingVertical: 8, gap: 12 }}>
      <TextInput value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor={theme.mutedForeground} style={{ fontSize: 18, color: theme.foreground, padding: 0 }} />
      {parsed.map((block, index) => block.type === 'text' ? <TextInput key={block.id} value={block.text} onFocus={() => setActiveTextId(block.id)} onChangeText={(text) => updateTextBlock(block.id, text)} onSelectionChange={(event) => setSelection(event.nativeEvent.selection)} multiline maxLength={10000} placeholder={index === 0 ? 'Write responder observations…' : undefined} placeholderTextColor={theme.mutedForeground} style={{ minHeight: block.text ? 28 : 96, padding: 0, color: theme.foreground, textAlignVertical: 'top', lineHeight: 20 }} /> : <View key={block.id} style={{ width: 118, height: 118, borderRadius: 12, overflow: 'hidden', alignSelf: 'flex-start' }}><Image source={{ uri: block.uri }} contentFit="cover" style={{ width: '100%', height: '100%' }} /><View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, backgroundColor: 'rgba(0,0,0,.25)' }}><Pressable accessibilityLabel="Open note image" onPress={() => setViewerId(block.id)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,.72)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="eye" size={18} color="#fff" /></Pressable><Pressable accessibilityLabel="Remove note image" onPress={() => removeImage(block.id)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,.72)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="trash-outline" size={18} color="#ff8066" /></Pressable></View></View>)}
    </View>
    <InputAccessoryView nativeID="responder-note-toolbar"><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, paddingBottom: Platform.OS === 'ios' ? 8 : 12, backgroundColor: "transparent" }}><Pressable accessibilityLabel="Insert image at cursor" onPress={() => setChooser(true)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="image-outline" size={19} color={theme.foreground} /></Pressable><Pressable accessibilityLabel="Bold" onPress={() => setMarkdown((value) => `${value.slice(0, selection.start)}**bold**${value.slice(selection.end)}`)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' }}><ThemedText selectable style={{ fontWeight: '800' }}>B</ThemedText></Pressable><Pressable accessibilityLabel="Undo" style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="arrow-undo" size={19} color={theme.foreground} /></Pressable><View style={{ flex: 1 }} /><ThemedText selectable color="mutedForeground" style={{ fontSize: 12 }}>{saveStatus}</ThemedText></View></InputAccessoryView>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, backgroundColor: "transparent" }}><Pressable accessibilityLabel="Insert image at cursor" onPress={() => setChooser(true)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="image-outline" size={19} color={theme.foreground} /></Pressable><Pressable accessibilityLabel="Bold" onPress={() => setMarkdown((value) => `${value.slice(0, selection.start)}**bold**${value.slice(selection.end)}`)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' }}><ThemedText selectable style={{ fontWeight: '800' }}>B</ThemedText></Pressable><Pressable accessibilityLabel="Undo" style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.card, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="arrow-undo" size={19} color={theme.foreground} /></Pressable><View style={{ flex: 1 }} /><ThemedText selectable color="mutedForeground" style={{ fontSize: 12 }}>{saveStatus}</ThemedText></View>
    <Modal visible={chooser} transparent animationType="slide" onRequestClose={() => setChooser(false)}><View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.55)' }}><View style={{ padding: 18, paddingBottom: 30, gap: 10, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: theme.card }}><ThemedText type="heading">Insert image</ThemedText><Pressable onPress={() => void add('camera')} style={{ height: 52, borderRadius: 14, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}><ThemedText style={{ color: theme.primaryForeground, fontWeight: '700' }}>Take a photo</ThemedText></Pressable><Pressable onPress={() => void add('library')} style={{ height: 52, borderRadius: 14, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}><ThemedText style={{ fontWeight: '600' }}>Choose from library</ThemedText></Pressable><Pressable onPress={() => setChooser(false)} style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}><ThemedText color="mutedForeground">Cancel</ThemedText></Pressable></View></View></Modal>
    <Modal visible={viewerId !== null} animationType="fade" onRequestClose={() => setViewerId(null)}><View style={{ flex: 1, backgroundColor: '#050708', alignItems: 'center', justifyContent: 'center' }}>{viewerId ? <Image source={{ uri: images.get(viewerId) }} contentFit="contain" style={{ width: '100%', height: '78%' }} /> : null}<View style={{ position: 'absolute', top: 52, right: 20, flexDirection: 'row', gap: 12 }}><Pressable accessibilityLabel="Delete image" onPress={() => viewerId && removeImage(viewerId)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,.7)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="trash-outline" size={22} color="#ff8066" /></Pressable><Pressable accessibilityLabel="Close image" onPress={() => setViewerId(null)} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,.7)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="close" size={24} color="#fff" /></Pressable></View><View style={{ position: 'absolute', bottom: 48, flexDirection: 'row', gap: 56, alignItems: 'center' }}><Pressable disabled={!viewerId || imageBlocks.findIndex((b) => b.id === viewerId) <= 0} onPress={() => { const i = imageBlocks.findIndex((b) => b.id === viewerId); if (i > 0) setViewerId(imageBlocks[i - 1].id); }}><Ionicons name="chevron-back-circle" size={44} color="#fff" /></Pressable><Pressable disabled={!viewerId || imageBlocks.findIndex((b) => b.id === viewerId) >= imageBlocks.length - 1} onPress={() => { const i = imageBlocks.findIndex((b) => b.id === viewerId); if (i >= 0 && i < imageBlocks.length - 1) setViewerId(imageBlocks[i + 1].id); }}><Ionicons name="chevron-forward-circle" size={44} color="#fff" /></Pressable></View></View></Modal>
  </View>;
}


