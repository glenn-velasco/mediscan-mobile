import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Platform } from 'react-native';

import { buildEmergencyQrPayload, queueDynamicEmergencyCardPublication } from '@/services/dynamic-emergency-card.service';
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
} from '@/features/qr-widget/qr-notification';
import * as emergencyHistoryRepo from '@/db/repositories/emergency-field-history.repo';
import { useProfessionalEncounters } from '@/features/professional-encounters/useProfessionalEncounters';

export function useQrWidget(userId: string | number) {
  const { data: medicalInformation } = useMedicalInformation();
  const { data: allergies } = useAllergies();
  const { data: conditions } = useConditions();
  const { data: diagnoses } = useDiagnoses();
  const { data: medications } = useMedications();
  const { data: emergencyContacts } = useEmergencyContacts();
  const { data: professionalEncounters } = useProfessionalEncounters();
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
  }, [userId, medicalInformation, allergies, conditions, diagnoses, medications, emergencyContacts, recentHistory, professionalEncounters]);

  useEffect(() => {
    if (!medicalInformation) return;

    /* Re-runs whenever the profile data changes (React Query hands a new reference
       after any edit is invalidated). `cancelled` guarantees only the latest run
       writes the QR, so a mid-flight edit is never dropped. */
    let cancelled = false;

    buildEmergencyQrPayload(userId)
      .then((res) => (res ? generateQrImage(res.payload) : null))
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

          let androidWidget: typeof import('../../../modules/qr-widget-android/src/QrWidget').default | null = null;
          if (Platform.OS === 'android') {
            /* On Android the home-screen widget AND the persistent notification
               are both rendered by the native module, which decodes the PNG with
               BitmapFactory. That API needs a filesystem path, not a file:// URI. */
            try {
              const module: NonNullable<typeof import('../../../modules/qr-widget-android/src/QrWidget').default> =
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                require('../../../modules/qr-widget-android/src/QrWidget').default;
              androidWidget = module;
              const nativePath = imagePath.replace(/^file:\/\//, '');
              await module.saveQrImage(nativePath);
            } catch (e) {
              console.warn('Failed to update Android QR widget:', e);
            }
          }

          /* The home-screen widget does not need notification permission. */
          const notifyGranted = await ensureNotificationPermission();
          if (notifyGranted) {
            const currentAndroidWidget = androidWidget;
            if (Platform.OS === 'android' && currentAndroidWidget !== null) {
              const nativePath = imagePath.replace(/^file:\/\//, '');
              await currentAndroidWidget.showQrNotification(nativePath);
            } else if (Platform.OS !== 'android') {
              await showQrNotification(imagePath);
            }
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
  }, [userId, medicalInformation, allergies, conditions, diagnoses, medications, emergencyContacts, recentHistory, professionalEncounters]);
}
