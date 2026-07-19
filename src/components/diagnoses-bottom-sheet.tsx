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
import { DiagnosisSeverityBadge } from '@/components/diagnosis-severity-badge';
import { DateField } from '@/components/form/date-field';
import { useDiagnoses } from '@/features/diagnoses/useDiagnoses';
import { useCreateDiagnosis } from '@/features/diagnoses/useCreateDiagnosis';
import { useUpdateDiagnosis } from '@/features/diagnoses/useUpdateDiagnosis';
import { useDeleteDiagnosis } from '@/features/diagnoses/useDeleteDiagnosis';
import { DIAGNOSIS_SEVERITY_OPTIONS, type DiagnosisSeverity } from '@/constants/diagnosis-severity';
import { useTheme } from '@/hooks/use-theme';
import { useGuardedPress } from '@/lib/use-guarded-press';
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

const DiagnosisSheetRow = memo(function DiagnosisSheetRow({
  item,
  onPress,
  theme,
}: {
  item: DiagnosisRow;
  onPress: (uuid: string) => void;
  theme: Record<string, string>;
}) {
  return (
    <Pressable onPress={() => onPress(item.local_uuid)} className="flex-row items-center justify-between py-3">
      <View className="flex-1 shrink">
        <ThemedText style={{ color: theme.foreground }}>{item.condition}</ThemedText>
        {item.date_of_diagnosis ? (
          <ThemedText type="small" color="mutedForeground">
            Diagnosed {item.date_of_diagnosis}
          </ThemedText>
        ) : null}
      </View>
      <DiagnosisSeverityBadge severity={item.severity} />
    </Pressable>
  );
});

export const DiagnosesBottomSheet = forwardRef<DiagnosesBottomSheetHandle>(
  function DiagnosesBottomSheet(_props, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const theme = useTheme();
    const { data: diagnoses = [], isLoading } = useDiagnoses();
    const { mutateAsync: createDiagnosis, isPending } = useCreateDiagnosis();
    const { mutateAsync: updateDiagnosis, isPending: isSaving } = useUpdateDiagnosis();
    const { mutateAsync: deleteDiagnosis, isPending: isDeleting } = useDeleteDiagnosis();
    const [mode, setMode] = useState<Mode>('list');
    const [selectedUuid, setSelectedUuid] = useState<string | null>(null);

    // Add/view form state
    const [condition, setCondition] = useState('');
    const [dateOfDiagnosis, setDateOfDiagnosis] = useState('');
    const [severity, setSeverity] = useState<DiagnosisSeverity>('chronic');

    const resetForm = useCallback(() => {
      setCondition('');
      setDateOfDiagnosis('');
      setSeverity('chronic');
    }, []);

    const loadItem = useCallback(
      (localUuid: string) => {
        const item = diagnoses.find((d) => d.local_uuid === localUuid);
        if (!item) return false;
        setCondition(item.condition);
        setDateOfDiagnosis(item.date_of_diagnosis ?? '');
        setSeverity(item.severity);
        setSelectedUuid(localUuid);
        return true;
      },
      [diagnoses],
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
      if (!condition.trim()) return;
      await createDiagnosis({ condition, date_of_diagnosis: dateOfDiagnosis || undefined, severity });
      sheetRef.current?.dismiss();
    }, [condition, dateOfDiagnosis, severity, createDiagnosis]);

    const handleSave = useCallback(async () => {
      if (!selectedUuid || !condition.trim()) return;
      await updateDiagnosis({
        localUuid: selectedUuid,
        payload: { condition, date_of_diagnosis: dateOfDiagnosis || undefined, severity },
      });
      setMode('list');
    }, [selectedUuid, condition, dateOfDiagnosis, severity, updateDiagnosis]);

    const handleDelete = useCallback(() => {
      if (!selectedUuid) return;
      Alert.alert('Delete diagnosis', `Are you sure you want to delete "${condition}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteDiagnosis(selectedUuid);
            setMode('list');
          },
        },
      ]);
    }, [selectedUuid, condition, deleteDiagnosis]);

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
            data={diagnoses}
            keyExtractor={(item) => item.local_uuid}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
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
            renderItem={({ item }) => (
              <DiagnosisSheetRow item={item} onPress={handlePress} theme={theme} />
            )}
            ListFooterComponent={
              <Pressable
                onPress={handleAdd}
                className="mt-4 flex-row items-center justify-center gap-2 rounded-md py-3"
                style={{ backgroundColor: theme.primary }}
              >
                <Ionicons name="add" size={18} color={theme.primaryForeground} />
                <ThemedText style={{ fontWeight: '600', color: theme.primaryForeground }}>Add diagnosis</ThemedText>
              </Pressable>
            }
          />
          )
        ) : (
          <View className="px-6 pb-10 pt-2">
            <View className="mb-4 flex-row items-center justify-between">
              <ThemedText type="overline">{mode === 'view' ? 'Diagnosis' : 'Add diagnosis'}</ThemedText>
              <Pressable onPress={() => setMode('list')} hitSlop={8}>
                <Ionicons name="arrow-back" size={20} color={theme.mutedForeground} />
              </Pressable>
            </View>

            <View className="gap-3">
              <View>
                <ThemedText type="label" className="mb-1.5">
                  Condition *
                </ThemedText>
                <BottomSheetTextInput
                  value={condition}
                  onChangeText={setCondition}
                  placeholder="e.g. Type 2 diabetes"
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

              <DateField
                label="Date of diagnosis"
                value={dateOfDiagnosis}
                onChange={setDateOfDiagnosis}
                maximumDate={new Date()}
              />

              <View className="mb-2">
                <ThemedText type="label" className="mb-1.5">
                  Severity
                </ThemedText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {DIAGNOSIS_SEVERITY_OPTIONS.map((option) => {
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
              disabled={!condition.trim()}
              onPress={mode === 'view' ? handleSave : handleSubmit}
              className="mt-2"
            />
            {mode === 'view' ? (
              <PrimaryButton
                label="Delete diagnosis"
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
