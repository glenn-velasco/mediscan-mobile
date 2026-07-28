import { View } from 'react-native';
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { sheet } from '@/components/form/tokens';
import { useTheme } from '@/hooks/use-theme';
import { useNetworkStatus } from '@/hooks/use-network-status';

export function OfflineBanner() {
  const { isConnected } = useNetworkStatus();
  const theme = useTheme();

  if (isConnected) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(300)}
      exiting={FadeOutDown.duration(200)}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        paddingBottom: 34,
        paddingHorizontal: 16,
        paddingTop: 8,
      }}
    >
      <View
        style={{
          backgroundColor: theme.destructive,
          borderRadius: sheet.rowRadius,
          paddingVertical: 10,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
        }}
      >
        <ThemedText
          type="smallBold"
          color="destructiveForeground"
        >
          No internet connection
        </ThemedText>
      </View>
    </Animated.View>
  );
}
