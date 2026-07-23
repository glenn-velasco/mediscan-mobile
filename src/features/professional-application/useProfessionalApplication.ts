import { useQuery } from '@tanstack/react-query';

import { getMyProfessionalApplication, getProfessionalApplication } from '@/api/endpoints/professional-applications';
import type { ProfessionalApplicationStatus } from '@/api/types';
import {
  myProfessionalApplicationQueryKey,
  professionalApplicationBroadcastStatusQueryKey,
  professionalApplicationQueryKey,
} from '@/lib/query-keys';

export { professionalApplicationQueryKey };

/** The current user's latest professional application (any status), or null if they've never applied. */
export function useMyProfessionalApplication() {
  return useQuery({
    queryKey: myProfessionalApplicationQueryKey,
    queryFn: getMyProfessionalApplication,
    // The app persists the query cache to AsyncStorage and restores it on cold start, so a
    // previously-cached `null` (from before the user had applied) would otherwise be served as
    // "fresh" for the global staleTime window instead of refetching. Always refetch on mount here
    // so the account screen reflects a newly-created application right away.
    staleTime: 0,
  });
}

/**
 * Reads the last status pushed over the realtime broadcast for this application (see
 * ProfessionalApplicationStatusChanged in realtime/events/handlers.ts), independent of the
 * GET-by-id query below. Used as a fallback so the status screen can still show something
 * meaningful if that GET 404s.
 */
export function useProfessionalApplicationBroadcastStatus(applicationId: number | undefined) {
  return useQuery<ProfessionalApplicationStatus | undefined>({
    queryKey: [...professionalApplicationBroadcastStatusQueryKey, applicationId],
    // Never actually fetched — this query only ever gets data pushed into it via
    // queryClient.setQueryData from the broadcast handler. enabled: false keeps it from running
    // queryFn, but useQuery still reactively picks up cache pushes for this key.
    queryFn: () => undefined,
    enabled: false,
    staleTime: Infinity,
  });
}

/** Polls (and is invalidated by ProfessionalApplicationStatusChanged, see realtime/events/handlers.ts) an application's review status. */
export function useProfessionalApplication(applicationId: number | undefined) {
  return useQuery({
    queryKey: [...professionalApplicationQueryKey, applicationId],
    queryFn: () => getProfessionalApplication(applicationId!),
    // A denied application is soft-deleted, not hard-deleted, and GET /professional-applications/{id}
    // is bound with withTrashed() on the backend specifically so this keeps working (with
    // rejection_reason intact) until the record is pruned days later — see
    // routes/api/v1.php and ProfessionalApplicationService::prune() on the backend.
    enabled: !!applicationId,
    // Backend processing (OCR + liveness + face-match) typically finishes in seconds; poll while
    // it's still in flight so the status screen updates even if the realtime event is missed.
    // Bail out once the query is erroring — react-query keeps the last-successful `data` around on
    // failure, so a stale `status: 'processing'` from before the fetch started failing would
    // otherwise keep this interval alive forever, hammering a 404 every 3s indefinitely.
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false;
      return query.state.data?.status === 'processing' ? 3000 : false;
    },
  });
}
