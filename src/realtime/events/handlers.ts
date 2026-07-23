import type { QueryClient } from '@tanstack/react-query';

import { addNotification } from '@/features/notifications/notifications.store';
import { showLocalNotification } from '@/lib/notifications';
import { registrationMatchQueryKey } from '@/features/registration-match/usePendingRegistrationMatch';
import { pendingSyncQueryKey } from '@/features/pending-sync/usePendingSync';
import { attestationsQueryKey } from '@/features/professional-attestations/useAttestations';
import { professionalApplicationQueryKey } from '@/features/professional-application/useProfessionalApplication';
import { professionalApplicationBroadcastStatusQueryKey } from '@/lib/query-keys';
import type { UserChannelEventHandlers } from '@/realtime/events/types';
import { pullPendingSync } from '@/services/pending-sync.service';
import { pullPatientChanges } from '@/services/patient-sync.service';

const TAG = '[EventHandler]';

// Only the terminal outcomes get a bell notification — processing/pending_review are mid-flow
// states the user is typically still looking at the in-app status screen for.
const APPLICATION_STATUS_NOTIFICATION: Partial<Record<string, { title: string; body: string }>> = {
  approved: { title: 'Application approved', body: 'Your professional verification was approved.' },
  denied: { title: 'Application denied', body: 'Your professional verification was not approved. Tap for details.' },
  auto_rejected: { title: 'Application rejected', body: 'Your professional verification was rejected during automatic checks. Tap for details.' },
};

export function createUserChannelHandlers(deps: {
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  queryClient: QueryClient;
}): UserChannelEventHandlers {
  return {
    EmailChanged: async () => {
      console.log(TAG, 'EmailChanged received');
      await deps.refreshUser();
    },

    EmailVerified: async () => {
      console.log(TAG, 'EmailVerified received');
      await deps.refreshUser();
    },

    UserDeactivated: async () => {
      console.log(TAG, 'UserDeactivated received');
      await deps.logout();
    },

    UserDeleted: async () => {
      console.log(TAG, 'UserDeleted received');
      await deps.logout();
    },

    PendingSyncEnvelopeCreated: async (payload) => {
      console.log(TAG, 'PendingSyncEnvelopeCreated received', { id: payload.envelope_id });
      await pullPendingSync();
      await deps.queryClient.invalidateQueries({ queryKey: pendingSyncQueryKey });
      await deps.queryClient.invalidateQueries({ queryKey: attestationsQueryKey });
    },

    // Independent of PendingSyncEnvelopeCreated above - this is the patient-authored CRUD sync
    // system (see docs/SYNC.md), not the BLE/professional-attestation relay. Triggers an immediate
    // pull instead of waiting for the 60s poll in src/sync/triggers.ts; that poll stays as a
    // fallback for missed events (offline delivery gaps), not the primary trigger.
    PatientRecordUpdated: async (payload) => {
      console.log(TAG, 'PatientRecordUpdated received', { recordType: payload.record_type, recordId: payload.record_id });
      await pullPatientChanges();
    },

    ProfessionalApplicationStatusChanged: async (payload) => {
      console.log(TAG, 'ProfessionalApplicationStatusChanged received', { id: payload.application_id, status: payload.status });
      // Seeded before the invalidate/refetch below so the status screen has a known-good status
      // to fall back on even if the subsequent GET 404s (see useProfessionalApplication.ts).
      deps.queryClient.setQueryData([...professionalApplicationBroadcastStatusQueryKey, payload.application_id], payload.status);
      const content = APPLICATION_STATUS_NOTIFICATION[payload.status];
      if (content) {
        const href = `/professional-application/${payload.application_id}`;
        void addNotification({ ...content, href });
        void showLocalNotification({ ...content, data: { href } });
      }
      await deps.queryClient.invalidateQueries({ queryKey: [...professionalApplicationQueryKey, payload.application_id] });
      try {
        await deps.refreshUser();
      } catch {
        console.warn(TAG, 'refreshUser failed — likely offline, will pick up changes on next online fetch');
      }
    },

    MedicalInformationRegistrationMatchCreated: async (payload) => {
      console.log(TAG, 'MedicalInformationRegistrationMatchCreated received', { id: payload.medical_information_registration_match_id });
      void addNotification({
        title: 'Verification needed',
        body: 'Someone registered claiming to be linked to your medical record. Was this you?',
        href: `/registration-match/${payload.medical_information_registration_match_id}`,
      });
      await deps.queryClient.invalidateQueries({ queryKey: registrationMatchQueryKey });
    },
  };
}
