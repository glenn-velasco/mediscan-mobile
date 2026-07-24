import { forwardRef, useImperativeHandle, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView, type BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import type { OnboardingTask, OnboardingTaskId } from '@/onboarding/useOnboardingChecklist';

export type OnboardingChecklistSheetHandle = {
  present: () => void;
  dismiss: () => void;
};

type OnboardingChecklistSheetProps = {
  tasks: OnboardingTask[];
  onSelectTask: (id: OnboardingTaskId) => void;
};

function renderBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />;
}

export const OnboardingChecklistSheet = forwardRef<OnboardingChecklistSheetHandle, OnboardingChecklistSheetProps>(
  function OnboardingChecklistSheet({ tasks, onSelectTask }, ref) {
    const sheetRef = useRef<BottomSheetModal>(null);
    const theme = useTheme();

    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.present(),
      dismiss: () => sheetRef.current?.dismiss(),
    }), []);

    return (
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['60%']}
        enableDynamicSizing={false}
        backgroundStyle={{ backgroundColor: theme.background, borderRadius: 20 }}
        handleIndicatorStyle={{ backgroundColor: theme.border, width: 36 }}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={{ paddingHorizontal: 20, paddingBottom: 24, gap: 4 }}>
          <ThemedText className="mb-2 font-semibold text-lg">Finish setting up</ThemedText>
          {tasks.map((task) => (
            <Pressable
              key={task.id}
              disabled={task.done}
              onPress={() => onSelectTask(task.id)}
              className="flex-row items-center gap-3 py-3"
            >
              <View
                className="h-9 w-9 items-center justify-center rounded-lg"
                style={{ backgroundColor: task.done ? theme.success + '15' : theme.muted }}
              >
                <Ionicons name={task.done ? 'checkmark' : task.icon} size={18} color={task.done ? theme.success : theme.mutedForeground} />
              </View>
              <View className="flex-1">
                <ThemedText className={task.done ? 'font-semibold' : undefined} style={task.done ? { textDecorationLine: 'line-through', color: theme.mutedForeground } : undefined}>
                  {task.title}
                </ThemedText>
                <ThemedText type="small" color="mutedForeground">
                  {task.body}
                </ThemedText>
              </View>
              {!task.done ? <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} /> : null}
            </Pressable>
          ))}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);
