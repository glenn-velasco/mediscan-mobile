import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { cn } from '@/lib/cn';
import { useTheme } from '@/hooks/use-theme';

type PrimaryButtonProps = {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'danger' | 'ghost';
} & Omit<PressableProps, 'children'>;

export function PrimaryButton({ label, loading, variant = 'primary', disabled, className, ...rest }: PrimaryButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const getButtonStyle = () => {
    if (variant === 'primary') {
      return { backgroundColor: theme.primary };
    }
    if (variant === 'danger') {
      return { borderColor: theme.destructive, backgroundColor: 'transparent' };
    }
    return { backgroundColor: 'transparent' };
  };

  const getTextColor = () => {
    if (variant === 'primary') return theme.primaryForeground;
    if (variant === 'danger') return theme.destructive;
    return theme.foreground;
  };

  return (
    <Pressable
      disabled={isDisabled}
      className={cn(
        'items-center justify-center rounded-xl py-4 active:scale-[0.98]',
        isDisabled && 'opacity-50',
        variant === 'danger' && 'border',
        className,
      )}
      style={getButtonStyle()}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'ghost' ? theme.foreground : variant === 'danger' ? theme.destructive : theme.primaryForeground
          }
        />
      ) : (
        <ThemedText type="label" style={{ color: getTextColor(), letterSpacing: 0.2 }}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}
