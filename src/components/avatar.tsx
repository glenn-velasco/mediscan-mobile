import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';

import { type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ThemedText } from '@/components/themed-text';
import { cn } from '@/lib/cn';

export function Avatar({
  name,
  size = 48,
  className,
  textColor,
  imageUrl,
}: {
  name: string;
  size?: number;
  className?: string;
  textColor?: ThemeColor;
  imageUrl?: string | null;
}) {
  const theme = useTheme();
  const [imageError, setImageError] = useState(false);

  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';

  if (imageUrl && !imageError) {
    return (
      <View
        className={cn(className)}
        style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}
      >
        <Image
          source={{ uri: imageUrl }}
          style={{ width: size, height: size }}
          onError={() => setImageError(true)}
        />
      </View>
    );
  }

  return (
    <View
      className={cn('items-center justify-center rounded-full', className)}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: theme.accent }}
    >
      <ThemedText color={textColor ?? 'accentForeground'} className="font-semibold">{initials}</ThemedText>
    </View>
  );
}
