import { forwardRef, memo, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { View, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/primary-button';
import { SeverityBadge } from '@/components/severity-badge';
import { useAllergies } from '@/features/allergies/useAllergies';
import { useCreateAllergy } from '@/features/allergies/useCreateAllergy';
import { useUpdateAllergy } from '@/features/allergies/useUpdateAllergy';
import { useDeleteAllergy } from '@/features/allergies/useDeleteAllergy';
import { useTheme } from '@/hooks/use-theme';
import { useGuardedPress } from '@/lib/use-guarded-press';
import type { AllergyRow } from '@/db/schema';

export type AllergiesBottomSheetHandle = {
  present: () => void;
  presentAdd: () => void;
  presentView: (localUuid: string) => void;
  dismiss: () => void;
};

function renderBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />;
}

type Mode = 'list' | 'add' | 'view';

const SEVERITIES: AllergyRow['severity'][] = ['mild', 'moderate', 'severe', 'life-threatening'];

const AllergySheetRow = memo(function AllergySheetRow({
  item,
  onPress,
  theme,
}: {
  item: AllergyRow;
  onPress: (uuid: string) => void;
  theme: Record<string, string>;
}) {
  return (
    <Pressable onPress={() => onPress(item.local_uuid)} className="flex-row items-center justify-between py-3">
      <ThemedText style={{ flex: 1, flexShrink: 1, color: theme.foreground }}>{item.allergen}</ThemedText>
      <SeverityBadge severity={item.severity} />
    </Pressable>
  );
});

export const AllergiesBottomSheet = forwardRef<AllergiesBottomSheetHandle>(
  function AllergiesBottomSheet(_props, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const theme = useTheme();
    const { data: allergies = [], isLoading } = useAllergies();
    const { mutateAsync: createAllergy, isPending } = useCreateAllergy();
    const { mutateAsync: updateAllergy, isPending: isSaving } = useUpdateAllergy();
    const { mutateAsync: deleteAllergy, isPending: isDeleting } = useDeleteAllergy();
    const [mode, setMode] = useState<Mode>('list');
    const [selectedUuid, setSelectedUuid] = useState<string | null>(null);

    // Add/view form state
    const [allergen, setAllergen] = useState('');
    const [reaction, setReaction] = useState('');
    const [severity, setSeverity] = useState<AllergyRow['severity']>('mild');

    const resetForm = useCallback(() => {
      setAllergen('');
      setReaction('');
      setSeverity('mild');
    }, []);

    const loadItem = useCallback(
      (localUuid: string) => {
        const item = allergies.find((a) => a.local_uuid === localUuid);
        if (!item) return false;
        setAllergen(item.allergen);
        setReaction(item.reaction ?? '');
        setSeverity(item.severity);
        setSelectedUuid(localUuid);
        return true;
      },
      [allergies],
    );

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
      presentView: (localUuid: string) => {
        if (!loadItem(localUuid)) return;
        setMode('view');
        sheetRef.current?.present();
      },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const handlePress = useGuardedPress(
      useCallback(
        (localUuid: string) => {
          if (!loadItem(localUuid)) return;
          setMode('view');
        },
        [loadItem],
      ),
    );

    const handleAdd = useCallback(() => {
      resetForm();
      setMode('add');
    }, [resetForm]);

    const handleSubmit = useCallback(async () => {
      if (!allergen.trim()) return;
      await createAllergy({ allergen, reaction: reaction || undefined, severity });
      sheetRef.current?.dismiss();
    }, [allergen, reaction, severity, createAllergy]);

    const handleSave = useCallback(async () => {
      if (!selectedUuid || !allergen.trim()) return;
      await updateAllergy({ localUuid: selectedUuid, payload: { allergen, reaction: reaction || undefined, severity } });
      setMode('list');
    }, [selectedUuid, allergen, reaction, severity, updateAllergy]);

    const handleDelete = useCallback(() => {
      if (!selectedUuid) return;
      Alert.alert('Delete allergy', `Are you sure you want to delete "${allergen}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteAllergy(selectedUuid);
            setMode('list');
          },
        },
      ]);
    }, [selectedUuid, allergen, deleteAllergy]);

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['50%']}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: theme.background, borderRadius: 20 }}
        handleIndicatorStyle={{ backgroundColor: theme.border, width: 36 }}
        backdropComponent={renderBackdrop}
        onDismiss={() => setMode('list')}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        {mode === 'list' ? (
          isLoading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
          <BottomSheetFlatList
            data={allergies}
            keyExtractor={(item) => item.local_uuid}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
            ListHeaderComponent={
              <View className="mb-4 flex-row items-center justify-between">
                <ThemedText type="overline">Allergies</ThemedText>
                <Pressable onPress={() => sheetRef.current?.dismiss()} hitSlop={8}>
                  <Ionicons name="close" size={20} color={theme.mutedForeground} />
                </Pressable>
              </View>
            }
            ListEmptyComponent={
              <View className="items-center py-8">
                <Ionicons name="alert-circle-outline" size={40} color={theme.mutedForeground} style={{ marginBottom: 12 }} />
                <ThemedText color="mutedForeground">No allergies yet.</ThemedText>
              </View>
            }
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.border }} />}
            renderItem={({ item }) => (
              <AllergySheetRow item={item} onPress={handlePress} theme={theme} />
            )}
            ListFooterComponent={
              <Pressable
                onPress={handleAdd}
                className="mt-4 flex-row items-center justify-center gap-2 rounded-md py-3"
                style={{ backgroundColor: theme.primary }}
              >
                <Ionicons name="add" size={18} color={theme.primaryForeground} />
                <ThemedText style={{ fontWeight: '600', color: theme.primaryForeground }}>Add allergy</ThemedText>
              </Pressable>
            }
          />
          )
        ) : (
          <View className="px-6 pb-10 pt-2">
            <View className="mb-4 flex-row items-center justify-between">
              <ThemedText type="overline">{mode === 'view' ? 'Allergy' : 'Add allergy'}</ThemedText>
              <Pressable onPress={() => setMode('list')} hitSlop={8}>
                <Ionicons name="arrow-back" size={20} color={theme.mutedForeground} />
              </Pressable>
            </View>

            <View className="gap-3">
              <View>
                <ThemedText type="label" className="mb-1.5">
                  Allergen *
                </ThemedText>
                <BottomSheetTextInput
                  value={allergen}
                  onChangeText={setAllergen}
                  placeholder="e.g. Peanuts"
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
                  Reaction (optional)
                </ThemedText>
                <BottomSheetTextInput
                  value={reaction}
                  onChangeText={setReaction}
                  placeholder="e.g. Hives"
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

              <View className="mb-2">
                <ThemedText type="label" className="mb-1.5">
                  Severity
                </ThemedText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {SEVERITIES.map((option) => {
                    const selected = option === severity;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => setSeverity(option)}
                        style={{
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: selected ? theme.primary : theme.input,
                          backgroundColor: selected ? theme.primary : 'transparent',
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                        }}
                      >
                        <ThemedText type="label" style={{ color: selected ? theme.primaryForeground : theme.foreground }}>
                          {option}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            <PrimaryButton
              label="Save"
              loading={mode === 'view' ? isSaving : isPending}
              disabled={!allergen.trim()}
              onPress={mode === 'view' ? handleSave : handleSubmit}
              className="mt-2"
            />
            {mode === 'view' ? (
              <PrimaryButton
                label="Delete allergy"
                variant="danger"
                loading={isDeleting}
                disabled={isSaving}
                onPress={handleDelete}
                className="mt-2"
              />
            ) : null}
          </View>
        )}
      </BottomSheetModal>
    );
  },
);
