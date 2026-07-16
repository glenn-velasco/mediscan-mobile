import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: ReactNode;
  onRightIconPress?: () => void;
} & Omit<ComponentProps<typeof TextInput>, 'value' | 'onChangeText'>;

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  ...rest
}: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View className="mb-4">
      <View className="relative">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ?? label}
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
        {leftIcon ? (
          <View
            className="absolute bottom-0 left-0 top-0 justify-center pl-3.5"
            pointerEvents="none"
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
