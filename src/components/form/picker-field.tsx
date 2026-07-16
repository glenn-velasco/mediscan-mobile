import { Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function PickerField<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View className="mb-6">
      <ThemedText type="small" color="mutedForeground" className="mb-1.5">
        {label}
      </ThemedText>
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => {
          const selected = option === value;
          return (
            <Pressable
              key={option}
              onPress={() => onChange(option)}
              className="rounded-full border px-3.5 py-1.5"
              style={{
                borderColor: selected ? theme.primary : theme.input,
                backgroundColor: selected ? theme.primary : 'transparent',
              }}
            >
              <ThemedText type="small" style={selected ? { color: theme.primaryForeground } : undefined}>
                {option}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
