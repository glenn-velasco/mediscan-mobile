import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { useUnreadNotificationCount } from '@/features/notifications/useNotifications';
import { useTheme } from '@/hooks/use-theme';

/** Bell icon with an unread-count badge, meant to sit beside identity info on the gradient header (mirrors QrIconButton). */
export function NotificationBellButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const unreadCount = useUnreadNotificationCount();

  return (
    <Pressable
      onPress={onPress}
      className="h-10 w-10 items-center justify-center rounded-full"
      style={{ backgroundColor: theme.primaryForeground + '20' }}
      hitSlop={12}
      accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
    >
      <Ionicons name="notifications" size={20} color={theme.primaryForeground} />
      {unreadCount > 0 ? (
        <View
          className="absolute -right-1 -top-1 min-w-[18px] items-center justify-center rounded-full px-1"
          style={{ height: 18, backgroundColor: theme.destructive }}
        >
          <ThemedText type="detail" style={{ color: '#fff', fontSize: 10, lineHeight: 12 }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </ThemedText>
        </View>
      ) : null}
    </Pressable>
  );
}
