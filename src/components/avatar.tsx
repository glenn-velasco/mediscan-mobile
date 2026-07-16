import { View } from 'react-native';

import { type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';
import { cn } from '@/lib/cn';

export function Avatar({
  name,
  size = 48,
  className,
  textColor,
}: {
  name: string;
  size?: number;
  className?: string;
  textColor?: ThemeColor;
}) {
  const theme = useTheme();
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';

  return (
    <View
      className={cn('items-center justify-center rounded-full', className)}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.accent }}
    >
      <ThemedText color={textColor ?? 'accentForeground'} className="font-semibold">{initials}</ThemedText>
    </View>
  );
}
