import { createElement, useRef } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useDerivedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { field, formTokens } from '@/components/form/tokens';

const AnimatedText = Animated.createAnimatedComponent(ThemedText);

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  error?: string;
  floatingLabelBackground?: string;
  disabled?: boolean;
};

function parseIsoDate(value: string): Date {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDisplay(value: string): string {
  return parseIsoDate(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  error,
  floatingLabelBackground,
  disabled,
}: DateFieldProps) {
  const theme = useTheme();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const floated = !!value;

  const progress = useDerivedValue(() => withTiming(floated ? 1 : 0, { duration: 150 }), [floated]);

  const labelContainerStyle = useAnimatedStyle(() => ({
    top: progress.value * -9,
    transform: [{ translateY: (1 - progress.value) * 14 }],
  }));

  const labelTextStyle = useAnimatedStyle(() => ({
    fontSize: field.fontSize - progress.value * 4,
    lineHeight: field.lineHeight - progress.value * 10,
  }));

  const valueTextStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  return (
    <View style={formTokens.container}>
      <Pressable
        onPress={() => {
          if (disabled) return;
          const el = inputRef.current;
          if (!el) return;
          if (typeof el.showPicker === 'function') {
            try {
              el.showPicker();
              return;
            } catch {
              // Fallback to focus/click
            }
          }
          el.focus();
          el.click();
        }}
        disabled={disabled}
        style={[
          formTokens.field,
          {
            position: 'relative',
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
            {label}
          </AnimatedText>
        </Animated.View>
        <AnimatedText style={[{ fontSize: field.fontSize, color: theme.foreground }, valueTextStyle]}>
          {value ? formatDisplay(value) : ''}
        </AnimatedText>
        {createElement('input', {
          ref: inputRef,
          type: 'date',
          value: value || '',
          min: minimumDate ? toIsoDate(minimumDate) : undefined,
          max: maximumDate ? toIsoDate(maximumDate) : undefined,
          disabled,
          'aria-label': label,
          onChange: (e: { target: { value?: string } }) => {
            if (e.target.value) onChange(e.target.value);
          },
          style: {
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: disabled ? 'not-allowed' : 'pointer',
          },
        })}
      </Pressable>
      {error ? (
        <ThemedText type="small" color="destructive" style={formTokens.errorText}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}
