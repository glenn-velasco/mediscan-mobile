import { useEffect } from 'react';
import { Platform } from 'react-native';

import type { EmergencyContactRow } from '@/db/schema';
import { buildEmergencySummary } from '@/lib/build-emergency-summary';
import { encryptQrPayload } from '@/lib/qr-cipher';
import { useAllergies } from '@/features/allergies/useAllergies';
import { useConditions } from '@/features/conditions/useConditions';
import { useDiagnoses } from '@/features/diagnoses/useDiagnoses';
import { useMedications } from '@/features/medications/useMedications';
import { useEmergencyContacts } from '@/features/emergency-contacts';
import { useMedicalInformation } from '@/features/medical-information/useMedicalInformation';
import { generateQrImage } from '@/features/qr-widget/qr-image-generator';
import {
  ensureNotificationPermission,
  showQrNotification,
  hideQrNotification,
} from '@/features/qr-widget/qr-notification';
import { useQrWidgetToggle } from '@/features/qr-widget/useQrWidgetToggle';

/* Stable empty references so an unresolved query doesn't churn the effect deps. */
const EMPTY_CONTACTS: EmergencyContactRow[] = [];

export function useQrWidget(userId: string | number) {
  const { enabled } = useQrWidgetToggle();
  const { data: medicalInformation } = useMedicalInformation();
  const { data: allergies } = useAllergies();
  const { data: conditions } = useConditions();
  const { data: diagnoses } = useDiagnoses();
  const { data: medications } = useMedications();
  const { data: emergencyContacts } = useEmergencyContacts();

  useEffect(() => {
    if (!enabled || !medicalInformation) return;

    /* Re-runs whenever the profile data changes (React Query hands a new reference
       after any edit is invalidated). `cancelled` guarantees only the latest run
       writes the QR, so a mid-flight edit is never dropped. */
    let cancelled = false;

    const plaintext = buildEmergencySummary(
      userId,
      new Date(),
      medicalInformation,
      allergies,
      emergencyContacts ?? EMPTY_CONTACTS,
      diagnoses,
      medications,
      conditions,
    );

    encryptQrPayload(plaintext)
      .then((encrypted) => generateQrImage(encrypted))
      .then(async (imagePath) => {
        if (cancelled || !imagePath) return;

        try {
          /* iOS widget */
          let widget: { updateSnapshot: (p: { imagePath: string }) => void } | null = null;
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            widget = require('@/widgets/EmergencyQrWidget').default;
          } catch { /* widget unavailable */ }
          widget?.updateSnapshot({ imagePath });

          /* The persistent notification requires runtime permission
             (POST_NOTIFICATIONS on Android 13+); the widget does not. */
          const notifyGranted = await ensureNotificationPermission();

          if (Platform.OS === 'android') {
            /* On Android the home-screen widget AND the persistent notification
               are both rendered by the native module, which decodes the PNG with
               BitmapFactory. That API needs a filesystem path, not a file:// URI. */
            try {
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              const m = require('../../../modules/qr-widget-android/src/QrWidget').default;
              const nativePath = imagePath.replace(/^file:\/\//, '');
              await m.saveQrImage(nativePath);
              if (notifyGranted) await m.showQrNotification(nativePath);
            } catch { /* module unavailable */ }
          } else if (notifyGranted) {
            await showQrNotification(imagePath);
          }
        } catch (e) {
          console.warn('Failed to sync QR widget:', e);
        }
      })
      .catch((e) => {
        console.warn('Failed to generate QR payload:', e);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, enabled, medicalInformation, allergies, conditions, diagnoses, medications, emergencyContacts]);

  useEffect(() => {
    const hide = () => {
      if (Platform.OS === 'android') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const m = require('../../../modules/qr-widget-android/src/QrWidget').default;
          m.hideQrNotification();
        } catch { /* module unavailable */ }
      } else {
        hideQrNotification();
      }
    };
    if (!enabled) {
      hide();
    }
    return () => {
      hide();
    };
  }, [enabled]);
}
