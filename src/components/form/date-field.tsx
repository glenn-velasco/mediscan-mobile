import { useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

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

/** Date input styled to match TextField, but the label doubles as the placeholder (shown in place of a value) instead of sitting above the field. */
export function DateField({ label, value, onChange, minimumDate, maximumDate, error }: DateFieldProps) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<BottomSheetModal>(null);

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
        className="rounded-xl px-4 py-2.5"
        style={{ backgroundColor: theme.card, borderWidth: 1, borderColor: error ? theme.destructive : theme.input }}
      >
        <ThemedText className="text-base" style={{ color: value ? theme.foreground : theme.mutedForeground }}>
          {value ? formatDisplay(value) : label}
        </ThemedText>
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
