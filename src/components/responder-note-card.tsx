import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { ResponderNote } from '@/types/emergency';

type Props = {
  onPress: () => void;
  note?: ResponderNote | null;
  onImagePress?: (uri: string) => void;
};

export function ResponderNoteCard({ onPress, note, onImagePress }: Props) {
  const theme = useTheme();
  const image = (uri: string, key: string) => (
    <Pressable key={key} accessibilityRole="button" accessibilityLabel="Preview responder note image" onPress={() => onImagePress?.(uri)} style={{ width: 118, height: 118, borderRadius: 12, overflow: 'hidden', alignSelf: 'flex-start' }}>
      <Image source={{ uri }} contentFit="cover" style={{ width: '100%', height: '100%' }} />
    </Pressable>
  );

  return <View style={{ padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card, gap: 10 }}>
    <Pressable accessibilityRole="button" onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <ThemedText type="overline">Responder note</ThemedText>
      <Ionicons name="chevron-forward" size={20} color={theme.mutedForeground} />
    </Pressable>
    {note?.title ? <ThemedText selectable type="bodyBold">{note.title}</ThemedText> : null}
    {note?.blocks?.length ? note.blocks.map((block) => block.type === 'text'
      ? <Pressable key={block.id} onPress={onPress}><ThemedText selectable>{block.text}</ThemedText></Pressable>
      : image(block.uri, block.id))
      : <>
        <Pressable onPress={onPress}><ThemedText selectable color={note?.text ? undefined : 'mutedForeground'}>{note?.text || 'Add what the next responder should know'}</ThemedText></Pressable>
        {note?.photoUris?.map((uri, index) => image(uri, `${uri}-${index}`))}
      </>}
  </View>;
}
