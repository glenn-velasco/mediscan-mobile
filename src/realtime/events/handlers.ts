import type { QueryClient } from '@tanstack/react-query';

import { pendingSyncQueryKey } from '@/features/pending-sync/usePendingSync';
import { attestationsQueryKey } from '@/features/professional-attestations/useAttestations';
import { professionalApplicationQueryKey } from '@/features/professional-application/useProfessionalApplication';
import type { UserChannelEventHandlers } from '@/realtime/events/types';
import { pullPendingSync } from '@/services/pending-sync.service';

const TAG = '[EventHandler]';

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

    ProfessionalApplicationStatusChanged: async (payload) => {
      console.log(TAG, 'ProfessionalApplicationStatusChanged received', { id: payload.application_id, status: payload.status });
      await deps.queryClient.invalidateQueries({ queryKey: [...professionalApplicationQueryKey, payload.application_id] });
      try {
        await deps.refreshUser();
      } catch {
        console.warn(TAG, 'refreshUser failed — likely offline, will pick up changes on next online fetch');
      }
    },
  };
}
