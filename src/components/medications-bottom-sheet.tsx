import { forwardRef, memo, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
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
import { useMedications } from '@/features/medications/useMedications';
import { useCreateMedication } from '@/features/medications/useCreateMedication';
import { useTheme } from '@/hooks/use-theme';
import type { MedicationRow } from '@/db/schema';

export type MedicationsBottomSheetHandle = { present: () => void; presentAdd: () => void; dismiss: () => void };

function renderBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />;
}

type Mode = 'list' | 'add';

const MedicationSheetRow = memo(function MedicationSheetRow({
  item,
  onPress,
  theme,
}: {
  item: MedicationRow;
  onPress: (uuid: string) => void;
  theme: Record<string, string>;
}) {
  return (
    <Pressable onPress={() => onPress(item.local_uuid)} className="flex-row items-center justify-between py-3">
      <View className="flex-1 shrink">
        <ThemedText style={{ color: theme.foreground }}>{item.name}</ThemedText>
        {item.dosage || item.frequency ? (
          <ThemedText type="small" color="mutedForeground">
            {[item.dosage, item.frequency].filter(Boolean).join(' · ')}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
});

export const MedicationsBottomSheet = forwardRef<MedicationsBottomSheetHandle>(
  function MedicationsBottomSheet(_props, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const router = useRouter();
    const theme = useTheme();
    const { data: medications = [], isLoading } = useMedications();
    const { mutateAsync: createMedication, isPending } = useCreateMedication();
    const [mode, setMode] = useState<Mode>('list');

    // Add form state
    const [name, setName] = useState('');
    const [dosage, setDosage] = useState('');
    const [frequency, setFrequency] = useState('');

    const resetForm = useCallback(() => {
      setName('');
      setDosage('');
      setFrequency('');
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
        router.push({ pathname: '/medications/[id]', params: { id: localUuid } } as any);
      },
      [router],
    );

    const handleAdd = useCallback(() => {
      resetForm();
      setMode('add');
    }, [resetForm]);

    const handleSubmit = useCallback(async () => {
      if (!name.trim()) return;
      await createMedication({ name, dosage, frequency });
      sheetRef.current?.dismiss();
    }, [name, dosage, frequency, createMedication]);

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['55%']}
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
            data={medications}
            keyExtractor={(item) => item.local_uuid}
            contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32 }}
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
            renderItem={({ item }) => (
              <MedicationSheetRow item={item} onPress={handlePress} theme={theme} />
            )}
            ListFooterComponent={
              <Pressable
                onPress={handleAdd}
                className="mt-4 flex-row items-center justify-center gap-2 rounded-md py-3"
                style={{ backgroundColor: theme.primary }}
              >
                <Ionicons name="add" size={18} color={theme.primaryForeground} />
                <ThemedText style={{ fontWeight: '600', color: theme.primaryForeground }}>Add medication</ThemedText>
              </Pressable>
            }
          />
          )
        ) : (
          <View className="px-6 pb-10 pt-2">
            <View className="mb-4 flex-row items-center justify-between">
              <ThemedText type="overline">Add medication</ThemedText>
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
                  placeholder="e.g. Metformin"
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
                  Dosage
                </ThemedText>
                <BottomSheetTextInput
                  value={dosage}
                  onChangeText={setDosage}
                  placeholder="e.g. 500mg"
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
                  Frequency
                </ThemedText>
                <BottomSheetTextInput
                  value={frequency}
                  onChangeText={setFrequency}
                  placeholder="e.g. Twice daily"
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
            </View>

            <PrimaryButton
              label="Save"
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
