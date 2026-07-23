import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';

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
    fontSize: 16 - progress.value * 4,
  }));

  const labelColor = error ? theme.destructive : focused ? theme.primary : theme.mutedForeground;

  return (
    <View className="mb-4">
      <View className="relative">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={floated ? placeholder : undefined}
          placeholderTextColor={theme.mutedForeground}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="rounded-xl px-4 py-3 text-base"
          style={{
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: error ? theme.destructive : focused ? theme.primary : theme.input,
            color: theme.foreground,
            fontFamily: 'Inter-Medium',
            paddingLeft: leftIcon ? 44 : 16,
            paddingRight: rightIcon ? 48 : 16,
            shadowColor: error ? theme.destructive : focused ? theme.primary : 'transparent',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: error ? 0.15 : focused ? 0.15 : 0,
            shadowRadius: 6,
            elevation: error || focused ? 1 : 0,
          }}
          {...rest}
        />
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', left: leftIcon ? 44 : 16, paddingHorizontal: 4 },
            containerStyle,
            floated ? { backgroundColor: floatingLabelBackground ?? theme.background } : null,
          ]}
        >
          <AnimatedText style={[{ color: labelColor, fontFamily: 'Inter-Medium' }, textStyle]}>{label}</AnimatedText>
        </Animated.View>
        {leftIcon ? (
          <View
            className="absolute bottom-0 left-0 top-0 justify-center pl-3.5"
            pointerEvents="none"
            style={{ elevation: error || focused ? 2 : 0 }}
          >
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
            className="absolute bottom-0 right-0 top-0 justify-center pr-2"
            hitSlop={8}
            style={{ elevation: error || focused ? 2 : 0 }}
          >
            {rightIcon}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <ThemedText type="small" color="destructive" className="mt-1.5">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}
