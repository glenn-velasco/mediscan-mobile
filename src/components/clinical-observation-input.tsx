import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Modal, Pressable, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useImagePreview } from '@/hooks/use-image-preview';
import { useTheme } from '@/hooks/use-theme';
import type { ResponderNoteBlock } from '@/types/emergency';

type ObservationImage = Extract<ResponderNoteBlock, { type: 'image' }>;

export function ClinicalObservationInput({
  value,
  onChangeText,
  images,
  onChangeImages,
  chooserVisible,
  onChangeChooserVisible,
}: {
  value: string;
  onChangeText: (value: string) => void;
  images: ObservationImage[];
  onChangeImages: (images: ObservationImage[]) => void;
  chooserVisible: boolean;
  onChangeChooserVisible: (visible: boolean) => void;
}) {
  const theme = useTheme();
  const preview = useImagePreview();
  const previewIndex = preview.uri ? images.findIndex((image) => image.uri === preview.uri) : -1;

  const addImages = async (source: 'camera' | 'library') => {
    onChangeChooserVisible(false);
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8 });
    if (result.canceled) return;
    const createdAt = new Date().toISOString();
    onChangeImages([
      ...images,
      ...result.assets.map((asset, index) => ({ id: `observation-image-${Date.now()}-${index}`, type: 'image' as const, uri: asset.uri, createdAt })),
    ]);
  };

  return (
    <View style={{ gap: 10 }}>
      <View style={{ minHeight: 132, borderWidth: 1, borderColor: theme.border, borderRadius: 12, backgroundColor: theme.card, padding: 14 }}>
        <ThemedText type="small" color="mutedForeground" style={{ marginBottom: 6 }}>Clinical observations</ThemedText>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          multiline
          maxLength={4000}
          placeholder="Write clinical observations…"
          placeholderTextColor={theme.mutedForeground}
          textAlignVertical="top"
          style={{ minHeight: 78, padding: 0, paddingRight: 42, color: theme.foreground, fontSize: 15, lineHeight: 21 }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add image to clinical observations"
          onPress={() => onChangeChooserVisible(true)}
          hitSlop={8}
          style={{ position: 'absolute', right: 10, bottom: 10, width: 38, height: 38, borderRadius: 19, backgroundColor: theme.primary + '18', alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="image-outline" size={20} color={theme.primary} />
        </Pressable>
      </View>

      {images.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {images.map((item) => (
            <Pressable accessibilityLabel="Preview observation image" onPress={() => preview.open(item.uri)} key={item.id} style={{ width: 92, height: 92, borderRadius: 12, overflow: 'hidden', backgroundColor: theme.muted }}>
              <Image source={{ uri: item.uri }} contentFit="cover" transition={180} cachePolicy="memory-disk" style={{ width: '100%', height: '100%' }} />
              <Pressable
                accessibilityLabel="Remove observation image"
                onPress={() => onChangeImages(images.filter((image) => image.id !== item.id))}
                style={{ position: 'absolute', right: 5, top: 5, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,.72)', alignItems: 'center', justifyContent: 'center' }}
              >
                <Ionicons name="close" size={17} color="#fff" />
              </Pressable>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Modal visible={chooserVisible} transparent animationType="slide" onRequestClose={() => onChangeChooserVisible(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.55)' }}>
          <View style={{ padding: 18, paddingBottom: 30, gap: 10, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: theme.card }}>
            <ThemedText type="heading">Add observation image</ThemedText>
            <Pressable onPress={() => void addImages('camera')} style={{ height: 52, borderRadius: 14, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
              <ThemedText style={{ color: theme.primaryForeground, fontWeight: '700' }}>Take a photo</ThemedText>
            </Pressable>
            <Pressable onPress={() => void addImages('library')} style={{ height: 52, borderRadius: 14, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
              <ThemedText style={{ fontWeight: '600' }}>Choose from library</ThemedText>
            </Pressable>
            <Pressable onPress={() => onChangeChooserVisible(false)} style={{ height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <ThemedText color="mutedForeground">Cancel</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal visible={preview.visible} transparent animationType="fade" onRequestClose={preview.close}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }}>
          {preview.uri ? <Image source={{ uri: preview.uri }} contentFit="contain" style={{ width: '92%', height: '72%' }} /> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Close image preview" onPress={preview.close} style={{ position: 'absolute', top: 56, right: 20, width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="close" size={25} color="#fff" />
          </Pressable>
          {images.length > 1 ? (
            <View style={{ position: 'absolute', bottom: 48, flexDirection: 'row', gap: 70 }}>
              <Pressable accessibilityRole="button" accessibilityLabel="Previous image" disabled={previewIndex <= 0} onPress={() => preview.open(images[previewIndex - 1].uri)}>
                <Ionicons name="chevron-back-circle" size={48} color={previewIndex > 0 ? '#fff' : '#666'} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Next image" disabled={previewIndex < 0 || previewIndex >= images.length - 1} onPress={() => preview.open(images[previewIndex + 1].uri)}>
                <Ionicons name="chevron-forward-circle" size={48} color={previewIndex >= 0 && previewIndex < images.length - 1 ? '#fff' : '#666'} />
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
