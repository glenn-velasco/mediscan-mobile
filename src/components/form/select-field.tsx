import { useCallback, useRef } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import Animated, { useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const AnimatedText = Animated.createAnimatedComponent(ThemedText);

function renderBackdrop(props: BottomSheetBackdropProps) {
  return <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />;
}

type SelectFieldProps<T extends string> = {
  /** Shown inside the trigger when unset, and as the sheet title. */
  placeholder: string;
  options: readonly T[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  /** Renders a "None" row that clears the selection. */
  allowClear?: boolean;
  error?: string;
  /** Maps an option value to its display label. Defaults to the raw value. */
  getLabel?: (value: T) => string;
  /** Background painted behind the floated label where it overlaps the border, so it blends into whatever the field sits on. Defaults to the screen background — override when nesting inside a Card or other surface using `theme.card`. */
  floatingLabelBackground?: string;
};

/** Select input styled to match TextField/DateField, opening a bottom sheet of options instead of a native picker. */
export function SelectField<T extends string>({
  placeholder,
  options,
  value,
  onChange,
  allowClear,
  error,
  getLabel = (v) => v,
  floatingLabelBackground,
}: SelectFieldProps<T>) {
  const theme = useTheme();
  const sheetRef = useRef<BottomSheetModal>(null);
  const floated = value !== undefined;

  const progress = useDerivedValue(() => withTiming(floated ? 1 : 0, { duration: 150 }), [floated]);

  const labelContainerStyle = useAnimatedStyle(() => ({
    top: progress.value * -9,
    transform: [{ translateY: (1 - progress.value) * 14 }],
  }));

  const labelTextStyle = useAnimatedStyle(() => ({
    fontSize: 16 - progress.value * 4,
  }));

  const valueTextStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const handleOpen = useCallback(() => sheetRef.current?.present(), []);

  const handleSelect = useCallback(
    (next: T | undefined) => {
      onChange(next);
      sheetRef.current?.dismiss();
    },
    [onChange],
  );

  return (
    <View className="mb-4">
      <Pressable
        onPress={handleOpen}
        className="relative flex-row items-center justify-between rounded-xl px-4 py-3"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: error ? theme.destructive : theme.input }}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', left: 16, paddingHorizontal: 4 },
            labelContainerStyle,
            floated ? { backgroundColor: floatingLabelBackground ?? theme.background } : null,
          ]}
        >
          <AnimatedText
            style={[
              { color: error ? theme.destructive : theme.mutedForeground, fontFamily: 'Inter-Medium' },
              labelTextStyle,
            ]}
          >
            {placeholder}
          </AnimatedText>
        </Animated.View>
        <AnimatedText className="text-base" style={[{ color: theme.foreground }, valueTextStyle]}>
          {value ? getLabel(value) : ''}
        </AnimatedText>
        <Ionicons name="chevron-down" size={16} color={theme.mutedForeground} />
      </Pressable>
      {error ? (
        <ThemedText type="small" color="destructive" className="mt-1">
          {error}
        </ThemedText>
      ) : null}

      <BottomSheetModal
        ref={sheetRef}
        stackBehavior="push"
        enableDynamicSizing
        backgroundStyle={{ backgroundColor: theme.background, borderRadius: 20 }}
        handleIndicatorStyle={{ backgroundColor: theme.border, width: 36 }}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView className="gap-1 px-6 pb-10 pt-2">
          <View className="mb-3 flex-row items-center justify-between">
            <ThemedText type="overline">
              {placeholder}
            </ThemedText>
            <Pressable onPress={() => sheetRef.current?.dismiss()} hitSlop={8}>
              <Ionicons name="close" size={20} color={theme.mutedForeground} />
            </Pressable>
          </View>

          {allowClear ? (
            <Pressable
              onPress={() => handleSelect(undefined)}
              className="flex-row items-center justify-between rounded-md px-2 py-3 active:bg-accent"
            >
              <ThemedText color="mutedForeground">None</ThemedText>
              {value === undefined ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
            </Pressable>
          ) : null}

          {options.map((option) => {
            const selected = option === value;
            return (
              <Pressable
                key={option}
                onPress={() => handleSelect(option)}
                className="flex-row items-center justify-between rounded-md px-2 py-3 active:bg-accent"
              >
                <ThemedText style={{ fontWeight: selected ? '600' : '400', color: selected ? theme.primary : theme.foreground }}>{getLabel(option)}</ThemedText>
                {selected ? <Ionicons name="checkmark" size={18} color={theme.primary} /> : null}
              </Pressable>
            );
          })}
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}
