import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

export function ThemedView({ className, style, ...rest }: ViewProps) {
  const theme = useTheme();
  return <View className={cn('bg-background', className)} style={[{ backgroundColor: theme.background }, style]} {...rest} />;
}
