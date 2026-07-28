import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { UseFormReturn } from 'react-hook-form';
import { useForm, useFormState } from 'react-hook-form';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetFlatList,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { ThemedText } from '@/components/themed-text';
import { BottomSheetFormWrapper } from '@/components/bottom-sheet-form-wrapper';
import { BottomSheetField } from '@/components/form/bottom-sheet-field';
import { sheet } from '@/components/form/tokens';
import { PrimaryButton } from '@/components/primary-button';
import { useMedications } from '@/features/medications/useMedications';
import { useCreateMedication } from '@/features/medications/useCreateMedication';
import { useUpdateMedication } from '@/features/medications/useUpdateMedication';
import { useDeleteMedication } from '@/features/medications/useDeleteMedication';
import { useTheme } from '@/hooks/use-theme';
import { useGuardedPress } from '@/lib/use-guarded-press';
import { medicationSchema, type MedicationFormValues } from '@/lib/validation/medication-schema';
import { zodResolver } from '@/lib/zod-resolver';
import type { MedicationRow } from '@/db/schema';

export type MedicationsBottomSheetHandle = {
  present: () => void;
  presentAdd: () => void;
  presentView: (localUuid: string) => void;
  dismiss: () => void;
};

function renderBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />;
}

type Mode = 'list' | 'add' | 'view';

function MedicationSheetRow({
  item,
  onPress,
  theme,
}: {
  item: MedicationRow;
  onPress: (uuid: string) => void;
  theme: Record<string, string>;
}) {
  return (
    <Pressable onPress={() => onPress(item.local_uuid)} className="py-3">
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.primary + '15' }}>
          <Ionicons name="medical" size={18} color={theme.primary} />
        </View>
        <View className="flex-1 shrink">
          <ThemedText className="font-semibold">{item.name}</ThemedText>
          {item.dosage || item.frequency ? (
            <ThemedText type="small" color="mutedForeground">
              {[item.dosage, item.frequency].filter(Boolean).join(' · ')}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function MedicationForm({ form, mode, isPending, isSaving, isDeleting, onSave, onDelete }: {
  form: UseFormReturn<MedicationFormValues>;
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
      <BottomSheetField control={form.control} name="name" label="Name *" placeholder="e.g. Metformin" />
      <BottomSheetField control={form.control} name="dosage" label="Dosage" placeholder="e.g. 500mg" />
      <BottomSheetField control={form.control} name="frequency" label="Frequency" placeholder="e.g. Twice daily" />

      <PrimaryButton
        label="Save"
        loading={mode === 'view' ? isSaving : isPending}
        disabled={!isDirty}
        onPress={onSave}
        className="mt-4"
      />
      {mode === 'view' ? (
        <PrimaryButton label="Delete medication" variant="danger" loading={isDeleting} disabled={isSaving} onPress={onDelete} className="mt-2" />
      ) : null}
    </BottomSheetFormWrapper>
  );
}

export const MedicationsBottomSheet = forwardRef<MedicationsBottomSheetHandle>(
  function MedicationsBottomSheet(_props, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const theme = useTheme();
    const { data: medications = [], isLoading } = useMedications();
    const { mutateAsync: createMedication, isPending } = useCreateMedication();
    const { mutateAsync: updateMedication, isPending: isSaving } = useUpdateMedication();
    const { mutateAsync: deleteMedication, isPending: isDeleting } = useDeleteMedication();
    const [mode, setMode] = useState<Mode>('list');
    const [selectedUuid, setSelectedUuid] = useState<string | null>(null);

    const form = useForm<MedicationFormValues>({
      resolver: zodResolver(medicationSchema),
      defaultValues: { name: '', dosage: '', frequency: '', notes: '' },
    });

    const resetForm = () => form.reset({ name: '', dosage: '', frequency: '', notes: '' });

    const loadItem = (localUuid: string) => {
      const item = medications.find((m) => m.local_uuid === localUuid);
      if (!item) return false;
      form.reset({ name: item.name, dosage: item.dosage, frequency: item.frequency, notes: '' });
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
      const payload = {
        name: data.name,
        dosage: data.dosage ?? '',
        frequency: data.frequency ?? '',
        notes: data.notes ?? '',
      };
      if (mode === 'view' && selectedUuid) {
        await updateMedication({ localUuid: selectedUuid, payload });
        setMode('list');
      } else {
        await createMedication(payload);
        sheetRef.current?.dismiss();
      }
    };

    const handleDelete = () => {
      if (!selectedUuid) return;
      Alert.alert('Delete medication', `Are you sure you want to delete "${form.getValues('name')}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { await deleteMedication(selectedUuid); setMode('list'); } },
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
              data={medications}
              keyExtractor={(item) => item.local_uuid}
              contentContainerStyle={{ paddingHorizontal: sheet.paddingH, paddingBottom: 32 }}
              ListHeaderComponent={
                <View className="mb-4 flex-row items-center justify-between">
                  <ThemedText type="overline">Medications</ThemedText>
                  <Pressable onPress={() => sheetRef.current?.dismiss()} hitSlop={8}>
                    <Ionicons name="close" size={20} color={theme.mutedForeground} />
                  </Pressable>
                </View>
              }
              ListEmptyComponent={
                <View className="items-center py-8">
                  <Ionicons name="medical-outline" size={40} color={theme.mutedForeground} style={{ marginBottom: 12 }} />
                  <ThemedText color="mutedForeground">No medications yet.</ThemedText>
                </View>
              }
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.border }} />}
              renderItem={({ item }) => <MedicationSheetRow item={item} onPress={handlePress} theme={theme} />}
              ListFooterComponent={
                <Pressable onPress={handleAdd} className="mt-4 flex-row items-center justify-center gap-2 rounded-xl py-3" style={{ backgroundColor: theme.primary }}>
                  <Ionicons name="add" size={18} color={theme.primaryForeground} />
                  <ThemedText type="bodyBold" color="primaryForeground">Add medication</ThemedText>
                </Pressable>
              }
            />
          )
        ) : (
          <MedicationForm form={form} mode={mode} isPending={isPending} isSaving={isSaving} isDeleting={isDeleting} onSave={() => void handleSave()} onDelete={handleDelete} />
        )}
      </BottomSheetModal>
    );
  },
);
