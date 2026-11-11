import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const DISMISSED_KEY = 'mediscan_ios_pwa_banner_dismissed';

export function IosInstallBanner() {
  const theme = useTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      if (window.localStorage.getItem(DISMISSED_KEY) === '1') return;
      const ua = window.navigator.userAgent || '';
      const isIos = /iPad|iPhone|iPod/.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
      const isStandalone =
        ('standalone' in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true) ||
        window.matchMedia?.('(display-mode: standalone)').matches === true;

      if (isIos && !isStandalone) {
        setVisible(true);
      }
    } catch {
      // Ignore storage/navigator errors
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // Ignore storage errors
    }
  };

  return (
    <View
      style={{
        backgroundColor: theme.card,
        borderTopWidth: 1,
        borderTopColor: theme.border,
        paddingHorizontal: 16,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Ionicons name="share-outline" size={22} color={theme.primary} />
      <View style={{ flex: 1 }}>
        <ThemedText type="small" style={{ fontWeight: '600' }}>
          Install Mediscan on your iPhone
        </ThemedText>
        <ThemedText type="small" color="mutedForeground">
          Tap the Safari Share button and select &ldquo;Add to Home Screen&rdquo; for full-screen offline access.
        </ThemedText>
      </View>
      <Pressable onPress={dismiss} hitSlop={8} accessibilityRole="button" accessibilityLabel="Dismiss install prompt">
        <Ionicons name="close" size={18} color={theme.mutedForeground} />
      </Pressable>
    </View>
  );
}
