import { memo } from 'react';
import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

export const Card = memo(function Card({ className, style, ...rest }: ViewProps) {
  const theme = useTheme();
  return (
    <View
      className={cn('rounded-2xl p-4', className)}
      style={[{ backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }, style]}
      {...rest}
    />
  );
});
