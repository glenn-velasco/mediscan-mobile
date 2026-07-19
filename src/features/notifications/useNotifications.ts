import { useSyncExternalStore } from 'react';

import { useAuth } from '@/auth/useAuth';
import { getSnapshot, subscribe, markAllRead, markRead, clearNotifications, type AppNotification } from '@/features/notifications/notifications.store';

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
  const state = useSyncExternalStore(subscribe, getSnapshot);
  const emailVerificationItem = useEmailVerificationItem();
  const items = emailVerificationItem ? [emailVerificationItem, ...state.items] : state.items;
  const unreadCount = items.reduce((count, n) => count + (n.read ? 0 : 1), 0);

  return { items, unreadCount, loaded: state.loaded, markAllRead, markRead, clearNotifications };
}

/** Lighter-weight binding for spots that only need the badge count (e.g. the Home header bell). */
export function useUnreadNotificationCount() {
  const state = useSyncExternalStore(subscribe, getSnapshot);
  const emailVerificationItem = useEmailVerificationItem();
  const storeUnread = state.items.reduce((count, n) => count + (n.read ? 0 : 1), 0);
  return storeUnread + (emailVerificationItem ? 1 : 0);
}
