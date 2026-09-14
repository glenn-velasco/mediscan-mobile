import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';

import type { EmergencyContactRow } from '@/db/schema';
import { buildEmergencyQrV2 } from '@/lib/emergency-qr-v2';
import { DEFAULT_EMERGENCY_DISCLOSURE } from '@/types/emergency';
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
import { queueDynamicEmergencyCardPublication } from '@/services/dynamic-emergency-card.service';
import * as emergencyHistoryRepo from '@/db/repositories/emergency-field-history.repo';

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
  const { data: recentHistory } = useQuery({
    queryKey: ['emergency-field-history', String(userId)],
    queryFn: () => emergencyHistoryRepo.getRecent(5, userId),
  });

  useEffect(() => {
    if (!medicalInformation) return;
    const timer = setTimeout(() => {
      void queueDynamicEmergencyCardPublication(userId);
    }, 750);
    return () => clearTimeout(timer);
  }, [userId, medicalInformation, allergies, conditions, diagnoses, medications, emergencyContacts, recentHistory]);

  useEffect(() => {
    if (!enabled || !medicalInformation) return;

    /* Re-runs whenever the profile data changes (React Query hands a new reference
       after any edit is invalidated). `cancelled` guarantees only the latest run
       writes the QR, so a mid-flight edit is never dropped. */
    let cancelled = false;

    buildEmergencyQrV2({
      patientId: userId,
      medical: medicalInformation,
      allergies: allergies ?? [],
      contacts: emergencyContacts ?? EMPTY_CONTACTS,
      diagnoses: diagnoses ?? [],
      medications: medications ?? [],
      conditions: conditions ?? [],
      disclosure: DEFAULT_EMERGENCY_DISCLOSURE,
      confirmedNone: DEFAULT_EMERGENCY_DISCLOSURE.confirmedNone,
      recentHistory,
    })
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
  }, [userId, enabled, medicalInformation, allergies, conditions, diagnoses, medications, emergencyContacts, recentHistory]);

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
