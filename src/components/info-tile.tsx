import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/card';
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

/**
 * A single labeled fact (blood type, phone, age…), built on top of Card so every info tile shares
 * the same rounded-2xl + bordered treatment as the rest of the app instead of its own one-off style
 * (this used to be a flat `theme.muted`-filled StatTile with no border, out of step with Card).
 */
export function InfoTile({
  icon,
  iconColor,
  iconBgKey,
  label,
  value,
  className,
  fullWidth = false,
}: {
  icon: IconName;
  iconColor: string;
  iconBgKey: IconBgKey;
  label: string;
  value: string;
  className?: string;
  fullWidth?: boolean;
}) {
  const theme = useTheme();
  const bgColor = hexToRgba(theme[iconBgKey], 0.12);

  return (
    <Card className={cn(fullWidth ? 'w-full gap-2.5' : 'flex-1 gap-2.5', className)}>
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: bgColor }}>
          <Ionicons name={icon} size={18} color={iconColor} />
        </View>
        <View className="flex-1 gap-0.5">
          <ThemedText type="small" color="mutedForeground">
            {label}
          </ThemedText>
          <ThemedText selectable type="bodyBold" numberOfLines={fullWidth ? undefined : 1}>
            {value}
          </ThemedText>
        </View>
      </View>
    </Card>
  );
}
