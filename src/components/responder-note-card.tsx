import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { ResponderNote } from '@/types/emergency';

type Props = {
  note?: ResponderNote | null;
  onImagePress?: (uri: string) => void;
};

export function ResponderNoteCard({ note, onImagePress }: Props) {
  const theme = useTheme();
  const hasContent = Boolean(note?.title?.trim() || note?.text?.trim() || note?.photoUris?.length || note?.blocks?.some((block) => block.type === 'image' || block.text.trim()));
  const image = (uri: string, key: string) => (
    <Pressable key={key} accessibilityRole="button" accessibilityLabel="Preview responder note image" onPress={() => onImagePress?.(uri)} style={{ width: 118, height: 118, borderRadius: 12, overflow: 'hidden', alignSelf: 'flex-start' }}>
      <Image source={{ uri }} contentFit="cover" style={{ width: '100%', height: '100%' }} />
    </Pressable>
  );

  return <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card, gap: 10 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Ionicons name="document-text-outline" size={17} color={theme.mutedForeground} />
      <ThemedText type="overline">Saved responder observations</ThemedText>
    </View>
    {note?.title ? <ThemedText selectable type="bodyBold">{note.title}</ThemedText> : null}
    {note?.blocks?.length ? note.blocks.filter((block) => block.type === 'image' || block.text.trim()).map((block) => block.type === 'text'
      ? <ThemedText selectable key={block.id} numberOfLines={3}>{block.text}</ThemedText>
      : image(block.uri, block.id))
      : <>
        {note?.text ? <ThemedText selectable numberOfLines={3}>{note.text}</ThemedText> : null}
        {note?.photoUris?.map((uri, index) => image(uri, `${uri}-${index}`))}
      </>}
    {!hasContent ? <ThemedText selectable color="mutedForeground">No responder observations or photos recorded yet.</ThemedText> : null}
    <ThemedText selectable type="small" color="mutedForeground">{hasContent ? 'Edit these in the encounter report above.' : 'Record these in the encounter report above.'}</ThemedText>
  </View>;
}
