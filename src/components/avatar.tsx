import { useEffect, useState } from 'react';
import { Image as RNImage } from 'react-native';

import { Avatar as RNAvatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Text } from '@/components/ui/text';
import { type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAvatarStore } from '@/stores/avatar-store';
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
  const [imageError, setImageError] = useState(false);
  const localUri = useAvatarStore((s) => s.localUri);
  const serverUrl = useAvatarStore((s) => s.serverUrl);
  const initStore = useAvatarStore((s) => s.init);

  useEffect(() => {
    initStore();
  }, [initStore]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImageError(false);
  }, [serverUrl, localUri]);

  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';

  const rnrSize = size <= 32 ? 'sm' : size <= 40 ? 'md' : size <= 48 ? 'lg' : 'xl';

  const imageUri = localUri ?? serverUrl;
  const isLocal = imageUri?.startsWith('file://');

  if (imageUri && !imageError) {
    return (
      <RNAvatar className={cn(className)} size={rnrSize}>
        {isLocal ? (
          <RNImage
            source={{ uri: imageUri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            onError={(e) => {
              console.warn('[Avatar] RN Image error:', e.nativeEvent);
              setImageError(true);
            }}
            onLoad={() => console.log('[Avatar] RN Image loaded:', imageUri)}
          />
        ) : (
          <AvatarImage
            source={{ uri: imageUri }}
            cachePolicy="none"
            contentFit="cover"
            transition={200}
            onLoad={() => console.log('[Avatar] expo-image loaded:', imageUri)}
            onError={(e) => {
              console.warn('[Avatar] expo-image error:', e);
              setImageError(true);
            }}
          />
        )}
        <AvatarFallback style={{ backgroundColor: theme.accent }}>
          <Text style={{ color: theme.accentForeground }}>{initials}</Text>
        </AvatarFallback>
      </RNAvatar>
    );
  }

  return (
    <RNAvatar className={cn(className)} size={rnrSize}>
      <AvatarFallback style={{ backgroundColor: theme.accent }}>
        <Text style={{ color: theme.accentForeground }}>{initials}</Text>
      </AvatarFallback>
    </RNAvatar>
  );
}
