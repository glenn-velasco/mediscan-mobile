import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';
import { field, formTokens } from '@/components/form/tokens';

const AnimatedText = Animated.createAnimatedComponent(ThemedText);

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: ReactNode;
  onRightIconPress?: () => void;
  /** Background painted behind the floated label where it overlaps the border, so it blends into whatever the field sits on. Defaults to the screen background — override when nesting inside a Card or other surface using `theme.card`. */
  floatingLabelBackground?: string;
} & Omit<ComponentProps<typeof TextInput>, 'value' | 'onChangeText'>;

const inputStyles = StyleSheet.create({
  input: {
    fontSize: field.fontSize,
    lineHeight: field.lineHeight,
    borderRadius: field.radius,
    paddingVertical: field.paddingV,
    fontFamily: field.fontFamily,
  },
});

/** A text input whose label sits centered like a placeholder at rest, then floats up to the top edge of the box on focus/value — so the field stays identifiable while typing without needing a separate caption. An explicit `placeholder` (example text, e.g. "e.g. Peanuts") only shows once the label has floated out of the way. */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  floatingLabelBackground,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const floated = focused || value.length > 0;

  const progress = useDerivedValue(() => withTiming(floated ? 1 : 0, { duration: 150 }), [floated]);

  const containerStyle = useAnimatedStyle(() => ({
    top: progress.value * -9,
    transform: [{ translateY: (1 - progress.value) * 14 }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    fontSize: field.fontSize - progress.value * 4,
  }));

  const labelColor = error ? theme.destructive : focused ? theme.primary : theme.mutedForeground;

  return (
    <View style={formTokens.container}>
      <View>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={floated ? placeholder : undefined}
          placeholderTextColor={theme.mutedForeground}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            inputStyles.input,
            {
              backgroundColor: theme.card,
              borderWidth: 1,
              borderColor: error ? theme.destructive : focused ? theme.primary : theme.input,
              color: theme.foreground,
              paddingLeft: leftIcon ? field.leftOffset : field.paddingH,
              paddingRight: rightIcon ? field.rightOffset : field.paddingH,
            },
          ]}
          {...rest}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            formTokens.labelContainer,
            { left: leftIcon ? field.labelLeftWithIcon : field.labelLeft },
            containerStyle,
            floated ? { backgroundColor: floatingLabelBackground ?? theme.background } : null,
          ]}
        >
          <AnimatedText style={[{ color: labelColor, fontFamily: field.fontFamily }, textStyle]}>{label}</AnimatedText>
        </Animated.View>
        {leftIcon ? (
          <View pointerEvents="none" style={formTokens.leftIcon}>
            <Ionicons
              name={leftIcon}
              size={20}
              color={error ? theme.destructive : focused ? theme.primary : theme.mutedForeground}
            />
          </View>
        ) : null}
        {rightIcon ? (
          <Pressable
            onPress={onRightIconPress}
            hitSlop={8}
            style={formTokens.rightIcon}
          >
            {rightIcon}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <ThemedText type="small" color="destructive" style={formTokens.errorText}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}
