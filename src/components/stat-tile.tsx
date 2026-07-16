import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/cn';

type IconName = ComponentProps<typeof Ionicons>['name'];
type IconBgKey = 'destructive' | 'primary' | 'warning' | 'success' | 'muted';

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function StatTile({
  icon,
  iconColor,
  iconBgKey,
  label,
  value,
  accent,
  className,
}: {
  icon: IconName;
  iconColor: string;
  iconBgKey: IconBgKey;
  label: string;
  value: string;
  accent?: boolean;
  className?: string;
}) {
  const theme = useTheme();
  const bgColor = hexToRgba(theme[iconBgKey], 0.12);

  return (
    <View
      className={cn('flex-1 gap-2.5 rounded-xl p-4', accent && 'pl-3', className)}
      style={{
        backgroundColor: theme.muted,
        borderLeftWidth: accent ? 3 : 0,
        borderLeftColor: accent ? iconColor : undefined,
      }}
    >
      <View className="flex-row items-center gap-3">
        <View
          className="h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: bgColor }}
        >
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <View className="flex-1 gap-0.5">
          <ThemedText type="small" color="mutedForeground">
            {label}
          </ThemedText>
          <ThemedText type="body" className="font-semibold">
            {value}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}
