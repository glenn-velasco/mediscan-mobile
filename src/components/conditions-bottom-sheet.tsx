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
import { useConditions } from '@/features/conditions/useConditions';
import { useCreateCondition } from '@/features/conditions/useCreateCondition';
import { useUpdateCondition } from '@/features/conditions/useUpdateCondition';
import { useDeleteCondition } from '@/features/conditions/useDeleteCondition';
import { useTheme } from '@/hooks/use-theme';
import { useGuardedPress } from '@/lib/use-guarded-press';
import type { ConditionRow } from '@/db/schema';

export type ConditionsBottomSheetHandle = {
  present: () => void;
  presentAdd: () => void;
  presentView: (localUuid: string) => void;
  dismiss: () => void;
};

function renderBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />;
}

type Mode = 'list' | 'add' | 'view';

const ConditionSheetRow = memo(function ConditionSheetRow({
  item,
  onPress,
  theme,
}: {
  item: ConditionRow;
  onPress: (uuid: string) => void;
  theme: Record<string, string>;
}) {
  return (
    <Pressable onPress={() => onPress(item.local_uuid)} className="flex-row items-center justify-between py-3">
      <ThemedText style={{ flex: 1, flexShrink: 1, color: theme.foreground }}>{item.description}</ThemedText>
    </Pressable>
  );
});

export const ConditionsBottomSheet = forwardRef<ConditionsBottomSheetHandle>(
  function ConditionsBottomSheet(_props, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const theme = useTheme();
    const { data: conditions = [], isLoading } = useConditions();
    const { mutateAsync: createCondition, isPending } = useCreateCondition();
    const { mutateAsync: updateCondition, isPending: isSaving } = useUpdateCondition();
    const { mutateAsync: deleteCondition, isPending: isDeleting } = useDeleteCondition();
    const [mode, setMode] = useState<Mode>('list');
    const [selectedUuid, setSelectedUuid] = useState<string | null>(null);

    // Add/view form state
    const [description, setDescription] = useState('');

    const resetForm = useCallback(() => {
      setDescription('');
    }, []);

    const loadItem = useCallback(
      (localUuid: string) => {
        const item = conditions.find((c) => c.local_uuid === localUuid);
        if (!item) return false;
        setDescription(item.description);
        setSelectedUuid(localUuid);
        return true;
      },
      [conditions],
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
      if (!description.trim()) return;
      await createCondition({ description });
      sheetRef.current?.dismiss();
    }, [description, createCondition]);

    const handleSave = useCallback(async () => {
      if (!selectedUuid || !description.trim()) return;
      await updateCondition({ localUuid: selectedUuid, payload: { description } });
      setMode('list');
    }, [selectedUuid, description, updateCondition]);

    const handleDelete = useCallback(() => {
      if (!selectedUuid) return;
      Alert.alert('Delete condition', `Are you sure you want to delete "${description}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCondition(selectedUuid);
            setMode('list');
          },
        },
      ]);
    }, [selectedUuid, description, deleteCondition]);

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
            data={conditions}
            keyExtractor={(item) => item.local_uuid}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
            ListHeaderComponent={
              <View className="mb-4 flex-row items-center justify-between">
                <ThemedText type="overline">Conditions</ThemedText>
                <Pressable onPress={() => sheetRef.current?.dismiss()} hitSlop={8}>
                  <Ionicons name="close" size={20} color={theme.mutedForeground} />
                </Pressable>
              </View>
            }
            ListEmptyComponent={
              <View className="items-center py-8">
                <Ionicons name="fitness-outline" size={40} color={theme.mutedForeground} style={{ marginBottom: 12 }} />
                <ThemedText color="mutedForeground">No conditions yet.</ThemedText>
              </View>
            }
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.border }} />}
            renderItem={({ item }) => (
              <ConditionSheetRow item={item} onPress={handlePress} theme={theme} />
            )}
            ListFooterComponent={
              <Pressable
                onPress={handleAdd}
                className="mt-4 flex-row items-center justify-center gap-2 rounded-md py-3"
                style={{ backgroundColor: theme.primary }}
              >
                <Ionicons name="add" size={18} color={theme.primaryForeground} />
                <ThemedText style={{ fontWeight: '600', color: theme.primaryForeground }}>Add condition</ThemedText>
              </Pressable>
            }
          />
          )
        ) : (
          <View className="px-6 pb-10 pt-2">
            <View className="mb-4 flex-row items-center justify-between">
              <ThemedText type="overline">{mode === 'view' ? 'Condition' : 'Add condition'}</ThemedText>
              <Pressable onPress={() => setMode('list')} hitSlop={8}>
                <Ionicons name="arrow-back" size={20} color={theme.mutedForeground} />
              </Pressable>
            </View>

            <View className="gap-3">
              <View>
                <ThemedText type="label" className="mb-1.5">
                  Description *
                </ThemedText>
                <BottomSheetTextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="e.g. Occasional migraines"
                  placeholderTextColor={theme.mutedForeground}
                  multiline
                  style={{
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: theme.input,
                    backgroundColor: theme.card,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    fontSize: 16,
                    minHeight: 88,
                    color: theme.foreground,
                    fontFamily: 'Inter-Medium',
                  }}
                />
              </View>
            </View>

            <PrimaryButton
              label="Save"
              loading={mode === 'view' ? isSaving : isPending}
              disabled={!description.trim()}
              onPress={mode === 'view' ? handleSave : handleSubmit}
              className="mt-2"
            />
            {mode === 'view' ? (
              <PrimaryButton
                label="Delete condition"
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
