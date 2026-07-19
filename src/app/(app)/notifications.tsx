import { FlatList, Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { AppLayout } from '@/components/layouts/app-layout';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSendEmailVerification } from '@/features/account/useSendEmailVerification';
import { EMAIL_VERIFICATION_NOTIFICATION_ID, useNotifications, type AppNotification } from '@/features/notifications/useNotifications';
import { useTheme } from '@/hooks/use-theme';

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function EmailVerificationRow({ item }: { item: AppNotification }) {
  const theme = useTheme();
  const { mutate: send, isPending } = useSendEmailVerification();

  return (
    <Card className="flex-row items-start gap-3">
      <View className="h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.warning + '15' }}>
        <Ionicons name="mail-unread" size={18} color={theme.warning} />
      </View>
      <View className="flex-1">
        <ThemedText className="font-semibold">{item.title}</ThemedText>
        <ThemedText type="small" color="mutedForeground" className="mt-0.5">
          {item.body}
        </ThemedText>
        <Pressable onPress={() => send()} disabled={isPending} hitSlop={8} className="mt-2 self-start">
          <ThemedText type="small" color="primary" className="font-semibold">
            {isPending ? 'Sending…' : 'Resend verification email'}
          </ThemedText>
        </Pressable>
      </View>
    </Card>
  );
}

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { items, loaded, markRead } = useNotifications();

  if (loaded && items.length === 0) {
    return (
      <ThemedView className="flex-1 items-center justify-center">
        <EmptyState title="No notifications yet" body="Updates about your account will show up here." icon="notifications-outline" />
      </ThemedView>
    );
  }

  const handlePress = (item: AppNotification) => {
    void markRead(item.id);
    if (item.href) router.push(item.href as never);
  };

  return (
    <AppLayout scrollable={false}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerClassName="gap-2"
        renderItem={({ item }) =>
          item.id === EMAIL_VERIFICATION_NOTIFICATION_ID ? (
            <EmailVerificationRow item={item} />
          ) : (
            <Pressable onPress={() => handlePress(item)}>
              <Card className="flex-row items-start gap-3">
                <View className="relative h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: theme.primary + '15' }}>
                  <Ionicons name="notifications" size={18} color={theme.primary} />
                  {!item.read ? (
                    <View className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.destructive }} />
                  ) : null}
                </View>
                <View className="flex-1">
                  <ThemedText className={item.read ? undefined : 'font-semibold'}>{item.title}</ThemedText>
                  <ThemedText type="small" color="mutedForeground" className="mt-0.5">
                    {item.body}
                  </ThemedText>
                  <ThemedText type="detail" color="mutedForeground" className="mt-1">
                    {timeAgo(item.createdAt)}
                  </ThemedText>
                </View>
              </Card>
            </Pressable>
          )
        }
      />
    </AppLayout>
  );
}
