import { memo, useCallback, useMemo } from 'react';
import { Link, Stack } from 'expo-router';
import { FlatList, Pressable, View , Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/empty-state';
import { useEmergencyContacts, useDeleteEmergencyContact } from '@/features/emergency-contacts';
import { useTheme } from '@/hooks/use-theme';
import { formatPhoneWithCountryCode } from '@/lib/format-phone';
import type { EmergencyContactRow } from '@/db/schema';

const ContactRow = memo(function ContactRow({
  item,
  onDelete,
  theme,
}: {
  item: EmergencyContactRow;
  onDelete: (name: string, uuid: string) => void;
  theme: Record<string, string>;
}) {
  const href = useMemo(
    () => ({ pathname: '/emergency-contacts/[localUuid]' as const, params: { localUuid: item.local_uuid } }),
    [item.local_uuid],
  );

  return (
    <Link href={href} asChild>
      <Pressable className="rounded-xl p-4" style={{ backgroundColor: theme.card }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <ThemedText type="smallBold">{item.name}</ThemedText>
            {item.relationship ? <ThemedText type="small" color="mutedForeground">{item.relationship}</ThemedText> : null}
            {item.phone ? <ThemedText type="small" color="mutedForeground">{formatPhoneWithCountryCode(item.phone_country_code, item.phone)}</ThemedText> : null}
          </View>
          <Pressable
            hitSlop={12}
            onPress={() => onDelete(item.name, item.local_uuid)}
          >
            <Ionicons name="trash-outline" size={20} color={theme.destructive} />
          </Pressable>
        </View>
      </Pressable>
    </Link>
  );
});

export default function EmergencyContactsScreen() {
  const { data: contacts, isLoading } = useEmergencyContacts();
  const deleteContact = useDeleteEmergencyContact();
  const theme = useTheme();

  const handleDelete = useCallback((name: string, localUuid: string) => {
    Alert.alert('Remove Contact', `Are you sure you want to remove ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => deleteContact.mutate(localUuid) },
    ]);
  }, [deleteContact]);

  return (
    <>
      <Stack.Screen options={{ headerRight: () => (
        <Link href="/emergency-contacts/new" asChild>
          <Pressable hitSlop={12}>
            <Ionicons name="add-circle" size={28} color={theme.primary} />
          </Pressable>
        </Link>
      )}} />

      <ThemedView className="flex-1">
        {isLoading ? (
          <ThemedView className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={theme.primary} />
          </ThemedView>
        ) : !contacts?.length ? (
          <ThemedView className="flex-1 items-center justify-center px-8">
            <EmptyState title="No emergency contacts" body="Add emergency contacts who can be reached during a medical emergency." />
            <Link href="/emergency-contacts/new" asChild>
              <Pressable className="mt-4 rounded-lg px-5 py-2.5" style={{ backgroundColor: theme.primary }}>
                <ThemedText type="link">Add Contact</ThemedText>
              </Pressable>
            </Link>
          </ThemedView>
        ) : (
          <FlatList
            data={contacts}
            keyExtractor={(item) => item.local_uuid}
            contentContainerStyle={{ padding: 16 }}
            ItemSeparatorComponent={() => <View className="h-2" />}
            renderItem={({ item }) => (
              <ContactRow item={item} onDelete={handleDelete} theme={theme} />
            )}
          />
        )}
      </ThemedView>
    </>
  );
}
