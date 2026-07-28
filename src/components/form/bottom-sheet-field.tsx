import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';
import { View } from 'react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';

import { ThemedText } from '@/components/themed-text';
import { field as formField, formTokens } from '@/components/form/tokens';
import { useTheme } from '@/hooks/use-theme';

type BottomSheetFieldProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  editable?: boolean;
};

export function BottomSheetField<T extends FieldValues>({ control, name, label, placeholder, multiline, editable }: BottomSheetFieldProps<T>) {
  const theme = useTheme();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const floated = (field.value ?? '').length > 0;

        return (
          <View style={formTokens.container}>
            <View>
              <BottomSheetTextInput
                value={field.value ?? ''}
                onChangeText={field.onChange}
                placeholder={floated ? placeholder : undefined}
                placeholderTextColor={theme.mutedForeground}
                multiline={multiline}
                editable={editable}
                style={{
                  borderRadius: formField.radius,
                  borderWidth: 1,
                  borderColor: fieldState.error ? theme.destructive : theme.input,
                  backgroundColor: theme.card,
                  paddingHorizontal: formField.paddingH,
                  paddingVertical: formField.paddingV,
                  fontSize: formField.fontSize,
                  lineHeight: formField.lineHeight,
                  color: theme.foreground,
                  fontFamily: formField.fontFamily,
                  minHeight: multiline ? 88 : undefined,
                }}
              />
              <View
                pointerEvents="none"
                style={[
                  formTokens.labelContainer,
                  { left: formField.labelLeft },
                  {
                    top: floated ? -9 : 0,
                    transform: [{ translateY: floated ? 0 : 14 }],
                  },
                  floated ? { backgroundColor: theme.background } : null,
                ]}
              >
                <ThemedText
                  style={{
                    color: fieldState.error ? theme.destructive : theme.mutedForeground,
                    fontFamily: formField.fontFamily,
                    fontSize: floated ? formField.fontSize - 4 : formField.fontSize,
                  }}
                >
                  {label}
                </ThemedText>
              </View>
            </View>
            {fieldState.error ? (
              <ThemedText type="small" color="destructive" style={formTokens.errorText}>
                {fieldState.error.message}
              </ThemedText>
            ) : null}
          </View>
        );
      }}
    />
  );
}
