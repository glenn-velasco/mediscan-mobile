import { useAuth } from '@/auth/useAuth';
import { useNotificationsStore, type AppNotification } from '@/features/notifications/notifications.store';

export type { AppNotification };

/** Synthetic id for the "verify your email" prompt — not stored (its presence is derived live from auth state, not an event), so it's never marked read/persisted like a real notification. */
export const EMAIL_VERIFICATION_NOTIFICATION_ID = 'email-verification';

function useEmailVerificationItem(): AppNotification | null {
  const { user } = useAuth();
  if (!user || user.email_verified_at) return null;
  return {
    id: EMAIL_VERIFICATION_NOTIFICATION_ID,
    title: 'Verify your email',
    body: 'Secure your account by verifying your email address.',
    createdAt: 0,
    read: false,
  };
}

/** React binding for the shared inbox in `notifications.store.ts` — see that file for why it's a plain module store. */
export function useNotifications() {
  const items = useNotificationsStore((s) => s.items);
  const loaded = useNotificationsStore((s) => s.loaded);
  const markAllRead = useNotificationsStore((s) => s.markAllRead);
  const markRead = useNotificationsStore((s) => s.markRead);
  const clearNotifications = useNotificationsStore((s) => s.clearNotifications);
  const emailVerificationItem = useEmailVerificationItem();
  const allItems = emailVerificationItem ? [emailVerificationItem, ...items] : items;
  const unreadCount = allItems.reduce((count, n) => count + (n.read ? 0 : 1), 0);

  return { items: allItems, unreadCount, loaded, markAllRead, markRead, clearNotifications };
}

/** Lighter-weight binding for spots that only need the badge count (e.g. the Home header bell). */
export function useUnreadNotificationCount() {
  const items = useNotificationsStore((s) => s.items);
  const emailVerificationItem = useEmailVerificationItem();
  const storeUnread = items.reduce((count, n) => count + (n.read ? 0 : 1), 0);
  return storeUnread + (emailVerificationItem ? 1 : 0);
}
