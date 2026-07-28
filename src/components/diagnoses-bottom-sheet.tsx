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

import { useAuth } from '@/auth/useAuth';
import { ThemedText } from '@/components/themed-text';
import { BottomSheetFormWrapper } from '@/components/bottom-sheet-form-wrapper';
import { BottomSheetField } from '@/components/form/bottom-sheet-field';
import { SelectField } from '@/components/form/select-field';
import { sheet } from '@/components/form/tokens';
import { PrimaryButton } from '@/components/primary-button';
import { DiagnosisSeverityBadge } from '@/components/diagnosis-severity-badge';
import { DateField } from '@/components/form/date-field';
import { useDiagnoses } from '@/features/diagnoses/useDiagnoses';
import { useCreateDiagnosis } from '@/features/diagnoses/useCreateDiagnosis';
import { useUpdateDiagnosis } from '@/features/diagnoses/useUpdateDiagnosis';
import { useDeleteDiagnosis } from '@/features/diagnoses/useDeleteDiagnosis';
import { DIAGNOSIS_SEVERITY_OPTIONS } from '@/constants/diagnosis-severity';
import { useTheme } from '@/hooks/use-theme';
import { useGuardedPress } from '@/lib/use-guarded-press';
import { formatIsoDate } from '@/lib/format-date';
import { diagnosisSchema, type DiagnosisFormValues } from '@/lib/validation/diagnosis-schema';
import { zodResolver } from '@/lib/zod-resolver';
import type { DiagnosisRow } from '@/db/schema';

export type DiagnosesBottomSheetHandle = {
  present: () => void;
  presentAdd: () => void;
  presentView: (localUuid: string) => void;
  dismiss: () => void;
};

function renderBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />;
}

type Mode = 'list' | 'add' | 'view';

function DiagnosisSheetRow({ item, onPress, theme }: { item: DiagnosisRow; onPress: (uuid: string) => void; theme: Record<string, string> }) {
  return (
    <Pressable onPress={() => onPress(item.local_uuid)} className="py-3">
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.warning + '15' }}>
          <Ionicons name="medkit" size={18} color={theme.warning} />
        </View>
        <View className="flex-1 shrink">
          <ThemedText className="font-semibold">{item.condition}</ThemedText>
          {item.date_of_diagnosis ? <ThemedText type="small" color="mutedForeground">Diagnosed {formatIsoDate(item.date_of_diagnosis)}</ThemedText> : null}
        </View>
        <DiagnosisSeverityBadge severity={item.severity} />
      </View>
    </Pressable>
  );
}

function DiagnosisForm({ form, mode, theme, readOnly, isPending, isSaving, isDeleting, onSave, onDelete }: {
  form: UseFormReturn<DiagnosisFormValues>;
  mode: Mode;
  theme: Record<string, string>;
  readOnly: boolean;
  isPending: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  onSave: () => void;
  onDelete: () => void;
}) {
  const { isDirty } = useFormState({ control: form.control });

  return (
    <BottomSheetFormWrapper>
      <BottomSheetField control={form.control} name="condition" label="Condition *" placeholder="e.g. Type 2 diabetes" editable={!readOnly} />
      <Controller
        control={form.control}
        name="date_of_diagnosis"
        render={({ field }) => (
          <DateField label="Date of diagnosis" value={field.value ?? ''} onChange={field.onChange} maximumDate={new Date()} disabled={readOnly} />
        )}
      />
      <Controller
        control={form.control}
        name="severity"
        render={({ field }) => (
          <SelectField
            placeholder="Severity"
            options={DIAGNOSIS_SEVERITY_OPTIONS}
            value={field.value}
            onChange={field.onChange}
            disabled={readOnly}
            getLabel={(v) => v.charAt(0).toUpperCase() + v.slice(1)}
          />
        )}
      />

      {readOnly ? null : (
        <PrimaryButton label="Save" loading={mode === 'view' ? isSaving : isPending} disabled={!isDirty} onPress={onSave} className="mt-4" />
      )}
      {mode === 'view' && !readOnly ? (
        <PrimaryButton label="Delete diagnosis" variant="danger" loading={isDeleting} disabled={isSaving} onPress={onDelete} className="mt-2" />
      ) : null}
    </BottomSheetFormWrapper>
  );
}

export const DiagnosesBottomSheet = forwardRef<DiagnosesBottomSheetHandle>(
  function DiagnosesBottomSheet(_props, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const theme = useTheme();
    const { user } = useAuth();
    const isVerifiedProfessional = user?.permissions?.includes('verified professional') ?? false;
    const { data: diagnoses = [], isLoading } = useDiagnoses();
    const { mutateAsync: createDiagnosis, isPending } = useCreateDiagnosis();
    const { mutateAsync: updateDiagnosis, isPending: isSaving } = useUpdateDiagnosis();
    const { mutateAsync: deleteDiagnosis, isPending: isDeleting } = useDeleteDiagnosis();
    const [mode, setMode] = useState<Mode>('list');
    const [selectedUuid, setSelectedUuid] = useState<string | null>(null);
    const readOnly = mode === 'view' && !isVerifiedProfessional;

    const form = useForm<DiagnosisFormValues>({
      resolver: zodResolver(diagnosisSchema),
      defaultValues: { condition: '', date_of_diagnosis: '', severity: 'chronic' },
    });

    const resetForm = () => form.reset({ condition: '', date_of_diagnosis: '', severity: 'chronic' });

    const loadItem = (localUuid: string) => {
      const item = diagnoses.find((d) => d.local_uuid === localUuid);
      if (!item) return false;
      form.reset({ condition: item.condition, date_of_diagnosis: item.date_of_diagnosis ?? '', severity: item.severity });
      setSelectedUuid(localUuid);
      return true;
    };

    useImperativeHandle(ref, () => ({
      present: () => { setMode('list'); sheetRef.current?.present(); },
      presentAdd: () => { if (!isVerifiedProfessional) return; resetForm(); setMode('add'); sheetRef.current?.present(); },
      presentView: (localUuid: string) => { if (!loadItem(localUuid)) return; setMode('view'); sheetRef.current?.present(); },
      dismiss: () => sheetRef.current?.dismiss(),
    }));

    const handlePress = useGuardedPress((localUuid: string) => {
      if (!loadItem(localUuid)) return;
      setMode('view');
    });

    const handleAdd = () => { if (!isVerifiedProfessional) return; resetForm(); setMode('add'); };

    const handleSave = async () => {
      const isValid = await form.trigger();
      if (!isValid) return;
      const data = form.getValues();
      if (mode === 'view' && selectedUuid) {
        await updateDiagnosis({ localUuid: selectedUuid, payload: data });
        setMode('list');
      } else {
        await createDiagnosis(data);
        sheetRef.current?.dismiss();
      }
    };

    const handleDelete = () => {
      if (!selectedUuid) return;
      Alert.alert('Delete diagnosis', `Are you sure you want to delete "${form.getValues('condition')}"?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { await deleteDiagnosis(selectedUuid); setMode('list'); } },
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
              data={diagnoses}
              keyExtractor={(item) => item.local_uuid}
              contentContainerStyle={{ paddingHorizontal: sheet.paddingH, paddingBottom: 32 }}
              ListHeaderComponent={
                <View className="mb-4 flex-row items-center justify-between">
                  <ThemedText type="overline">Diagnoses</ThemedText>
                  <Pressable onPress={() => sheetRef.current?.dismiss()} hitSlop={8}>
                    <Ionicons name="close" size={20} color={theme.mutedForeground} />
                  </Pressable>
                </View>
              }
              ListEmptyComponent={
                <View className="items-center py-8">
                  <Ionicons name="medkit-outline" size={40} color={theme.mutedForeground} style={{ marginBottom: 12 }} />
                  <ThemedText color="mutedForeground">No diagnoses yet.</ThemedText>
                </View>
              }
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.border }} />}
              renderItem={({ item }) => <DiagnosisSheetRow item={item} onPress={handlePress} theme={theme} />}
              ListFooterComponent={
                isVerifiedProfessional ? (
                  <Pressable onPress={handleAdd} className="mt-4 flex-row items-center justify-center gap-2 rounded-xl py-3" style={{ backgroundColor: theme.primary }}>
                    <Ionicons name="add" size={18} color={theme.primaryForeground} />
                    <ThemedText type="bodyBold" color="primaryForeground">Add diagnosis</ThemedText>
                  </Pressable>
                ) : null
              }
            />
          )
        ) : (
          <DiagnosisForm form={form} mode={mode} theme={theme} readOnly={readOnly} isPending={isPending} isSaving={isSaving} isDeleting={isDeleting} onSave={() => void handleSave()} onDelete={handleDelete} />
        )}
      </BottomSheetModal>
    );
  },
);
