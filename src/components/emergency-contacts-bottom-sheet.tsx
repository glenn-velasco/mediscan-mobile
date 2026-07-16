import { forwardRef, memo, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { View, Pressable, Switch, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { PhoneInput, type PhoneInputValue } from '@/components/form/phone-input';
import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/primary-button';
import { useEmergencyContacts, useCreateEmergencyContact } from '@/features/emergency-contacts';
import { useTheme } from '@/hooks/use-theme';
import type { EmergencyContactRow } from '@/db/schema';

export type EmergencyContactsBottomSheetHandle = { present: () => void; presentAdd: () => void; dismiss: () => void };

function renderBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />;
}

type Mode = 'list' | 'add';

const ContactSheetRow = memo(function ContactSheetRow({
  item,
  onPress,
  theme,
}: {
  item: EmergencyContactRow;
  onPress: (uuid: string) => void;
  theme: Record<string, string>;
}) {
  return (
    <Pressable onPress={() => onPress(item.local_uuid)} className="py-3">
      <View className="flex-row items-center justify-between">
        <View style={{ flex: 1 }}>
          <ThemedText style={{ color: theme.foreground }}>{item.name}</ThemedText>
          {item.relationship ? (
            <ThemedText type="label">
              {item.relationship}
            </ThemedText>
          ) : null}
        </View>
        {item.phone ? (
          <ThemedText type="label" color="primary">
            {item.phone_country_code ? `+${item.phone_country_code} ` : ''}
            {item.phone}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
});

export const EmergencyContactsBottomSheet = forwardRef<EmergencyContactsBottomSheetHandle>(
  function EmergencyContactsBottomSheet(_props, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const router = useRouter();
    const theme = useTheme();
    const { data: contacts = [], isLoading } = useEmergencyContacts();
    const { mutateAsync: createContact, isPending } = useCreateEmergencyContact();
    const [mode, setMode] = useState<Mode>('list');

    // Add form state
    const [name, setName] = useState('');
    const [relationship, setRelationship] = useState('');
    const [phoneValue, setPhoneValue] = useState<PhoneInputValue>({ countryCode: 'PH', phone: '' });
    const [isPrimary, setIsPrimary] = useState(false);

    const resetForm = useCallback(() => {
      setName('');
      setRelationship('');
      setPhoneValue({ countryCode: 'PH', phone: '' });
      setIsPrimary(false);
    }, []);

    useImperativeHandle(ref, () => ({
      present: () => {
        setMode('list');
        sheetRef.current?.present();
      },
      presentAdd: () => {
        resetForm();
        setMode('add');
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const handlePress = useCallback(
      (localUuid: string) => {
        sheetRef.current?.dismiss();
        router.push({ pathname: '/emergency-contacts/[localUuid]', params: { localUuid } } as any);
      },
      [router],
    );

    const handleAdd = useCallback(() => {
      resetForm();
      setMode('add');
    }, [resetForm]);

    const handleSubmit = useCallback(async () => {
      if (!name.trim()) return;
      await createContact({
        name,
        relationship: relationship || undefined,
        phone_country_code: phoneValue.countryCode || undefined,
        phone: phoneValue.phone || undefined,
        is_primary: isPrimary,
      });
      sheetRef.current?.dismiss();
    }, [name, relationship, phoneValue, isPrimary, createContact]);

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['50%']}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: theme.background, borderRadius: 20 }}
        handleIndicatorStyle={{ backgroundColor: theme.border, width: 36 }}
        backdropComponent={renderBackdrop}
        onDismiss={() => setMode('list')}
      >
        {mode === 'list' ? (
          isLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
          <BottomSheetFlatList
            data={contacts}
            keyExtractor={(item) => item.local_uuid}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
            ListHeaderComponent={
              <View className="mb-4 flex-row items-center justify-between">
                <ThemedText type="overline">Emergency contacts</ThemedText>
                <Pressable onPress={() => sheetRef.current?.dismiss()} hitSlop={8}>
                  <Ionicons name="close" size={20} color={theme.mutedForeground} />
                </Pressable>
              </View>
            }
            ListEmptyComponent={
              <View className="items-center py-8">
                <Ionicons name="people-outline" size={40} color={theme.mutedForeground} style={{ marginBottom: 12 }} />
                <ThemedText color="mutedForeground">No emergency contacts yet.</ThemedText>
              </View>
            }
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.border }} />}
            renderItem={({ item }) => (
              <ContactSheetRow item={item} onPress={handlePress} theme={theme} />
            )}
            ListFooterComponent={
              <Pressable
                onPress={handleAdd}
                className="mt-4 flex-row items-center justify-center gap-2 rounded-xl py-3"
                style={{ backgroundColor: theme.primary }}
              >
                <Ionicons name="add" size={18} color={theme.primaryForeground} />
                <ThemedText style={{ fontWeight: '600', color: theme.primaryForeground }}>Add contact</ThemedText>
              </Pressable>
            }
          />
          )
        ) : (
          <View className="px-6 pb-10 pt-2">
            <View className="mb-4 flex-row items-center justify-between">
              <ThemedText type="overline">Add emergency contact</ThemedText>
              <Pressable onPress={() => setMode('list')} hitSlop={8}>
                <Ionicons name="arrow-back" size={20} color={theme.mutedForeground} />
              </Pressable>
            </View>

            <View className="gap-3">
              <View>
                <ThemedText type="label" className="mb-1.5">
                  Name *
                </ThemedText>
                <BottomSheetTextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Juan Dela Cruz"
                  placeholderTextColor={theme.mutedForeground}
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.input,
                    backgroundColor: theme.card,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontSize: 16,
                    color: theme.foreground,
                    fontFamily: 'Inter-Medium',
                  }}
                />
              </View>

              <View>
                <ThemedText type="label" className="mb-1.5">
                  Relationship
                </ThemedText>
                <BottomSheetTextInput
                  value={relationship}
                  onChangeText={setRelationship}
                  placeholder="e.g. Spouse"
                  placeholderTextColor={theme.mutedForeground}
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.input,
                    backgroundColor: theme.card,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontSize: 16,
                    color: theme.foreground,
                    fontFamily: 'Inter-Medium',
                  }}
                />
              </View>

              <PhoneInput value={phoneValue} onChange={setPhoneValue} />

              <View className="flex-row items-center justify-between">
                <ThemedText>Primary contact</ThemedText>
                <Switch value={isPrimary} onValueChange={setIsPrimary} />
              </View>
            </View>

            <PrimaryButton
              label="Save contact"
              loading={isPending}
              disabled={!name.trim()}
              onPress={handleSubmit}
              className="mt-4"
            />
          </View>
        )}
      </BottomSheetModal>
    );
  },
);
