import { Alert, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'emergency-qr';
const NOTIFICATION_ID = 'emergency-qr-notification';

/**
 * Asks (once, if not already granted) for Do Not Disturb access so the emergency-QR
 * notification's channel can bypass DND and stay visible on the lock screen. Granting
 * happens on a system settings screen, so we explain first and let the user skip.
 * No-op on iOS.
 */
export async function ensureDndBypass(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require('../../../modules/qr-widget-android/src/QrWidget').default;
    if (await m.hasDndBypassAccess()) return;

    Alert.alert(
      'Show during Do Not Disturb?',
      'Allow the Emergency QR to stay visible on your lock screen even when Do Not Disturb is on, so first responders can always scan it.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open settings', onPress: () => void m.openDndBypassSettings() },
      ],
    );
  } catch {
    /* native module unavailable */
  }
}

/**
 * Ensures POST_NOTIFICATIONS (Android 13+) / user authorization (iOS) is granted.
 * Without it, both expo-notifications and the native manager.notify() silently
 * show nothing. Returns true if notifications are allowed.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Emergency QR Code',
      importance: Notifications.AndroidImportance.HIGH,
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
    });
  }
}

export async function showQrNotification(imagePath: string): Promise<void> {
  try {
    await setupNotificationChannel();

    const trigger: Notifications.NotificationTriggerInput =
      Platform.OS === 'android'
        ? { channelId: CHANNEL_ID }
        : null;

    await Notifications.dismissNotificationAsync(NOTIFICATION_ID).catch(() => {});

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID,
      content: {
        title: 'Emergency QR Code',
        body: 'First responders can tap to scan',
        data: { type: 'emergency-qr' },
        sticky: Platform.OS === 'android' ? true : undefined,
        priority: Platform.OS === 'android' ? 'high' : undefined,
        attachments: Platform.OS === 'ios'
          ? [{ identifier: 'qr-image', url: imagePath, type: 'png' }]
          : undefined,
      },
      trigger,
    });
  } catch (e) {
    console.warn('Failed to show QR notification:', e);
  }
}

export async function hideQrNotification(): Promise<void> {
  await Notifications.dismissNotificationAsync(NOTIFICATION_ID).catch(() => {});
}
