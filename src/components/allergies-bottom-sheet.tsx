import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UseFormReturn } from 'react-hook-form';
import { useForm, Controller, useFormState } from 'react-hook-form';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetFlatList,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { ThemedText } from '@/components/themed-text';
import { BottomSheetFormWrapper } from '@/components/bottom-sheet-form-wrapper';
import { BottomSheetField } from '@/components/form/bottom-sheet-field';
import { SelectField } from '@/components/form/select-field';
import { sheet } from '@/components/form/tokens';
import { PrimaryButton } from '@/components/primary-button';
import { SeverityBadge } from '@/components/severity-badge';
import { useAllergies } from '@/features/allergies/useAllergies';
import { useCreateAllergy } from '@/features/allergies/useCreateAllergy';
import { useUpdateAllergy } from '@/features/allergies/useUpdateAllergy';
import { useDeleteAllergy } from '@/features/allergies/useDeleteAllergy';
import { useTheme } from '@/hooks/use-theme';
import { useGuardedPress } from '@/lib/use-guarded-press';
import { allergySchema, type AllergyFormValues } from '@/lib/validation/allergy-schema';
import { zodResolver } from '@/lib/zod-resolver';
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

function AllergySheetRow({ item, onPress, theme }: { item: AllergyRow; onPress: (uuid: string) => void; theme: Record<string, string> }) {
  return (
    <Pressable onPress={() => onPress(item.local_uuid)} className="py-3">
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.warning + '15' }}>
          <Ionicons name="warning" size={18} color={theme.warning} />
        </View>
        <ThemedText className="flex-1 shrink font-semibold">{item.allergen}</ThemedText>
        <SeverityBadge severity={item.severity} />
      </View>
    </Pressable>
  );
}

function AllergyForm({ form, mode, isPending, isSaving, isDeleting, onSave, onDelete }: {
  form: UseFormReturn<AllergyFormValues>;
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
      <BottomSheetField control={form.control} name="allergen" label="Allergen *" placeholder="e.g. Peanuts" />
      <BottomSheetField control={form.control} name="reaction" label="Reaction (optional)" placeholder="e.g. Hives" />

      <Controller
        control={form.control}
        name="severity"
        render={({ field }) => (
          <SelectField
            placeholder="Severity"
            options={SEVERITIES}
            value={field.value}
            onChange={field.onChange}
            getLabel={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
          />
        )}
      />

      <PrimaryButton label="Save" loading={mode === 'view' ? isSaving : isPending} disabled={!isDirty} onPress={onSave} className="mt-4" />
      {mode === 'view' ? (
        <PrimaryButton label="Delete allergy" variant="danger" loading={isDeleting} disabled={isSaving} onPress={onDelete} className="mt-2" />
      ) : null}
    </BottomSheetFormWrapper>
  );
}

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

    const form = useForm<AllergyFormValues>({
      resolver: zodResolver(allergySchema),
      defaultValues: { allergen: '', reaction: '', severity: 'mild' },
    });

    const resetForm = () => form.reset({ allergen: '', reaction: '', severity: 'mild' });

    const loadItem = (localUuid: string) => {
      const item = allergies.find((a) => a.local_uuid === localUuid);
      if (!item) return false;
      form.reset({ allergen: item.allergen, reaction: item.reaction ?? '', severity: item.severity });
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
        await updateAllergy({ localUuid: selectedUuid, payload: data });
        setMode('list');
      } else {
        await createAllergy(data);
        sheetRef.current?.dismiss();
      }
    };

    const handleDelete = () => {
      if (!selectedUuid) return;
      Alert.alert('Delete allergy', `Are you sure you want to delete "${form.getValues('allergen')}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { await deleteAllergy(selectedUuid); setMode('list'); } },
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
              data={allergies}
              keyExtractor={(item) => item.local_uuid}
              contentContainerStyle={{ paddingHorizontal: sheet.paddingH, paddingBottom: 32 }}
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
              renderItem={({ item }) => <AllergySheetRow item={item} onPress={handlePress} theme={theme} />}
              ListFooterComponent={
                <Pressable onPress={handleAdd} className="mt-4 flex-row items-center justify-center gap-2 rounded-xl py-3" style={{ backgroundColor: theme.primary }}>
                  <Ionicons name="add" size={18} color={theme.primaryForeground} />
                  <ThemedText type="bodyBold" color="primaryForeground">Add allergy</ThemedText>
                </Pressable>
              }
            />
          )
        ) : (
          <AllergyForm form={form} mode={mode} isPending={isPending} isSaving={isSaving} isDeleting={isDeleting} onSave={() => void handleSave()} onDelete={handleDelete} />
        )}
      </BottomSheetModal>
    );
  },
);
