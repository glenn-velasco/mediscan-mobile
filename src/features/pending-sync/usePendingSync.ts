import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/auth/useAuth';
import * as pendingSyncEnvelopeRepo from '@/db/repositories/pending-sync-envelope.repo';
import { pullPendingSync } from '@/services/pending-sync.service';

export const pendingSyncQueryKey = ['pending-sync'] as const;

/** All pending-sync envelopes (relay- and BLE-received alike), newest first — for the status screen (Phase 7). */
export function usePendingSync() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...pendingSyncQueryKey, user?.id],
    queryFn: () => pendingSyncEnvelopeRepo.getAll(),
    enabled: !!user,
  });
}

/** Manual "retry pull" action — the automatic trigger (NetInfo/AppState/interval) lives in src/sync/triggers.ts (Phase 9). */
export function usePullPendingSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: pullPendingSync,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pendingSyncQueryKey });
    },
  });
}
