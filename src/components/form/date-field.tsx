import { useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
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

type DateFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  error?: string;
  /** Background painted behind the floated label where it overlaps the border, so it blends into whatever the field sits on. Defaults to the screen background — override when nesting inside a Card or other surface using `theme.card`. */
  floatingLabelBackground?: string;
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

/** Date input styled to match TextField — label floats to the top edge of the box once a date is picked, same as TextField/SelectField. */
export function DateField({ label, value, onChange, minimumDate, maximumDate, error, floatingLabelBackground }: DateFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<BottomSheetModal>(null);
  const floated = !!value;

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

  const handlePicked = (event: { type?: string }, date?: Date) => {
    if (event.type === 'set' && date) {
      onChange(toIsoDate(date));
    }
    if (Platform.OS === 'android') setOpen(false);
  };

  return (
    <View className="mb-4">
      <Pressable
        onPress={() => {
          if (Platform.OS === 'android') {
            setOpen(true);
          } else {
            sheetRef.current?.present();
          }
        }}
        className="relative rounded-xl px-4 py-3"
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
            {label}
          </AnimatedText>
        </Animated.View>
        <AnimatedText className="text-base" style={[{ color: theme.foreground }, valueTextStyle]}>
          {value ? formatDisplay(value) : ''}
        </AnimatedText>
      </Pressable>
      {error ? (
        <ThemedText type="small" color="destructive" className="mt-1">
          {error}
        </ThemedText>
      ) : null}

      {Platform.OS === 'android' ? (
        open ? (
          <DateTimePicker
            value={parseIsoDate(value)}
            mode="date"
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={handlePicked}
          />
        ) : null
      ) : (
        <BottomSheetModal
          ref={sheetRef}
          stackBehavior="push"
          enableDynamicSizing
          backgroundStyle={{ backgroundColor: theme.background, borderRadius: 20 }}
          handleIndicatorStyle={{ backgroundColor: theme.border, width: 36 }}
          backdropComponent={renderBackdrop}
        >
          <BottomSheetView className="px-4 pb-10 pt-2">
            <View className="mb-2 flex-row items-center justify-between border-b border-border pb-3">
              <ThemedText style={{ fontWeight: '600', color: theme.foreground }}>{label}</ThemedText>
              <Pressable onPress={() => sheetRef.current?.dismiss()} hitSlop={8}>
                <ThemedText style={{ color: theme.primary }}>Done</ThemedText>
              </Pressable>
            </View>
            <DateTimePicker
              value={parseIsoDate(value)}
              mode="date"
              display="inline"
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              onValueChange={(_event, date) => onChange(toIsoDate(date))}
            />
          </BottomSheetView>
        </BottomSheetModal>
      )}
    </View>
  );
}
