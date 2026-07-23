import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'application-status';

/** Asks (once, if not already granted) for OS notification permission. Returns false without prompting again if the user already denied it. */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

// Android 8+ decides heads-up/banner behavior from the channel's importance, not per-call fields —
// scheduling without one falls back to a default channel that doesn't reliably show a banner.
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Application updates',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Shows a one-shot local OS notification immediately. No-ops silently if permission isn't granted. */
export async function showLocalNotification(content: {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  const granted = await ensureNotificationPermission();
  if (!granted) return;

  await ensureChannel();

  const trigger: Notifications.NotificationTriggerInput = Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null;

  await Notifications.scheduleNotificationAsync({
    content: { title: content.title, body: content.body, data: content.data, sound: 'default' },
    trigger,
  });
}
