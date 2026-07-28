import { useCallback, useRef } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
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
import { field, formTokens, sheet } from '@/components/form/tokens';

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
  disabled?: boolean;
};

/** Select input styled to match TextField/DateField, opening a bottom sheet of options instead of a native picker. */
export function SelectField<T extends string>({
  placeholder,
  options,
  value,
  onChange,
  allowClear,
  error,
  // react-doctor-disable-next-line react-hooks-js/todo
  getLabel = (v) => v,
  floatingLabelBackground,
  disabled,
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
    fontSize: field.fontSize - progress.value * 4,
  }));

  const valueTextStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const handleOpen = useCallback(() => {
    Keyboard.dismiss();
    sheetRef.current?.present();
  }, []);

  const handleSelect = useCallback(
    (next: T | undefined) => {
      onChange(next);
      sheetRef.current?.dismiss();
    },
    [onChange],
  );

  return (
    <View style={formTokens.container}>
      <Pressable
        onPress={handleOpen}
        disabled={disabled}
        style={[
          formTokens.field,
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: theme.card,
            borderColor: error ? theme.destructive : theme.input,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            formTokens.labelContainer,
            { left: field.labelLeft },
            labelContainerStyle,
            floated ? { backgroundColor: floatingLabelBackground ?? theme.background } : null,
          ]}
        >
          <AnimatedText
            style={[
              { color: error ? theme.destructive : theme.mutedForeground, fontFamily: field.fontFamily },
              labelTextStyle,
            ]}
          >
            {placeholder}
          </AnimatedText>
        </Animated.View>
        <AnimatedText style={[{ fontSize: field.fontSize, color: theme.foreground }, valueTextStyle]}>
          {value ? getLabel(value) : ''}
        </AnimatedText>
        {value !== undefined ? (
          <Pressable
            onPress={(e) => {
              e.stopPropagation();
              onChange(undefined);
            }}
            hitSlop={8}
            disabled={disabled}
          >
            <Ionicons name="close-circle" size={18} color={theme.mutedForeground} />
          </Pressable>
        ) : (
          <Ionicons name="chevron-down" size={16} color={theme.mutedForeground} />
        )}
      </Pressable>
      {error ? (
        <ThemedText type="small" color="destructive" style={formTokens.errorText}>
          {error}
        </ThemedText>
      ) : null}

      <BottomSheetModal
        ref={sheetRef}
        stackBehavior="push"
        enableDynamicSizing
        backgroundStyle={{ backgroundColor: theme.background, borderRadius: sheet.radius }}
        handleIndicatorStyle={{ backgroundColor: theme.border, width: sheet.handleWidth }}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={{ paddingHorizontal: sheet.paddingH, paddingBottom: sheet.paddingB, paddingTop: sheet.paddingT, gap: 4 }}>
          <View style={[formTokens.sheetHeader, { borderBottomColor: theme.border }]}>
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
              style={formTokens.sheetRow}
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
                style={formTokens.sheetRow}
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
