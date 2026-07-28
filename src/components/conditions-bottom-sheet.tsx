import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetBackdrop,
  BottomSheetFlatList,
  BottomSheetModal,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import type { UseFormReturn } from 'react-hook-form';
import { useForm, useFormState } from 'react-hook-form';

import { PrimaryButton } from '@/components/primary-button';
import { BottomSheetFormWrapper } from '@/components/bottom-sheet-form-wrapper';
import { BottomSheetField } from '@/components/form/bottom-sheet-field';
import { sheet } from '@/components/form/tokens';
import { ThemedText } from '@/components/themed-text';
import type { ConditionRow } from '@/db/schema';
import { useConditions } from '@/features/conditions/useConditions';
import { useCreateCondition } from '@/features/conditions/useCreateCondition';
import { useDeleteCondition } from '@/features/conditions/useDeleteCondition';
import { useUpdateCondition } from '@/features/conditions/useUpdateCondition';
import { useTheme } from '@/hooks/use-theme';
import { useGuardedPress } from '@/lib/use-guarded-press';
import { conditionSchema, type ConditionFormValues } from '@/lib/validation/condition-schema';
import { zodResolver } from '@/lib/zod-resolver';

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

function ConditionSheetRow({ item, onPress, theme }: { item: ConditionRow; onPress: (uuid: string) => void; theme: Record<string, string> }) {
  return (
    <Pressable onPress={() => onPress(item.local_uuid)} className="py-3">
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.primary + '15' }}>
          <Ionicons name="fitness" size={18} color={theme.primary} />
        </View>
        <ThemedText className="flex-1 shrink font-semibold">{item.description}</ThemedText>
      </View>
    </Pressable>
  );
}

function ConditionForm({ form, mode, isPending, isSaving, isDeleting, onSave, onDelete }: {
  form: UseFormReturn<ConditionFormValues>;
  mode: Mode;
  isPending: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  onSave: () => void;
  onDelete: () => void;
}) {
  const { isDirty } = useFormState({ control: form.control });

  return (
    <BottomSheetFormWrapper>
      <BottomSheetField control={form.control} name="description" label="Description *" placeholder="e.g. Occasional migraines" multiline />
      <PrimaryButton label="Save" loading={mode === 'view' ? isSaving : isPending} disabled={!isDirty} onPress={onSave} className="mt-4" />
      {mode === 'view' ? (
        <PrimaryButton label="Delete condition" variant="danger" loading={isDeleting} disabled={isSaving} onPress={onDelete} className="mt-2" />
      ) : null}
    </BottomSheetFormWrapper>
  );
}

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

    const form = useForm<ConditionFormValues>({
      resolver: zodResolver(conditionSchema),
      defaultValues: { description: '' },
    });

    const resetForm = () => form.reset({ description: '' });

    const loadItem = (localUuid: string) => {
      const item = conditions.find((c) => c.local_uuid === localUuid);
      if (!item) return false;
      form.reset({ description: item.description });
      setSelectedUuid(localUuid);
      return true;
    };

    useImperativeHandle(ref, () => ({
      present: () => { setMode('list'); sheetRef.current?.present(); },
      presentAdd: () => { resetForm(); setMode('add'); sheetRef.current?.present(); },
      presentView: (localUuid: string) => { if (!loadItem(localUuid)) return; setMode('view'); sheetRef.current?.present(); },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const handlePress = useGuardedPress((localUuid: string) => {
      if (!loadItem(localUuid)) return;
      setMode('view');
    });

    const handleAdd = () => { resetForm(); setMode('add'); };

    const handleSave = async () => {
      const isValid = await form.trigger();
      if (!isValid) return;
      const data = form.getValues();
      if (mode === 'view' && selectedUuid) {
        await updateCondition({ localUuid: selectedUuid, payload: data });
        setMode('list');
      } else {
        await createCondition(data);
        sheetRef.current?.dismiss();
      }
    };

    const handleDelete = () => {
      if (!selectedUuid) return;
      Alert.alert('Delete condition', `Are you sure you want to delete "${form.getValues('description')}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { await deleteCondition(selectedUuid); setMode('list'); } },
      ]);
    };

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['50%', '90%']}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: theme.background, borderRadius: sheet.radius }}
        handleIndicatorStyle={{ backgroundColor: theme.border, width: sheet.handleWidth }}
        backdropComponent={renderBackdrop}
        onDismiss={() => setMode('list')}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
      >
        {mode === 'list' ? (
          isLoading ? (
            <View className="items-center py-8"><ActivityIndicator size="large" color={theme.primary} /></View>
          ) : (
            <BottomSheetFlatList
              data={conditions}
              keyExtractor={(item) => item.local_uuid}
              contentContainerStyle={{ paddingHorizontal: sheet.paddingH, paddingBottom: 32 }}
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
              renderItem={({ item }) => <ConditionSheetRow item={item} onPress={handlePress} theme={theme} />}
              ListFooterComponent={
                <Pressable onPress={handleAdd} className="mt-4 flex-row items-center justify-center gap-2 rounded-xl py-3" style={{ backgroundColor: theme.primary }}>
                  <Ionicons name="add" size={18} color={theme.primaryForeground} />
                  <ThemedText type="bodyBold" color="primaryForeground">Add condition</ThemedText>
                </Pressable>
              }
            />
          )
        ) : (
          <ConditionForm form={form} mode={mode} isPending={isPending} isSaving={isSaving} isDeleting={isDeleting} onSave={() => void handleSave()} onDelete={handleDelete} />
        )}
      </BottomSheetModal>
    );
  },
);
