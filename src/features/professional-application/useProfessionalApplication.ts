import { useQuery } from '@tanstack/react-query';

import { getProfessionalApplication } from '@/api/endpoints/professional-applications';
import type { ProfessionalApplicationStatus } from '@/api/types';
import { professionalApplicationBroadcastStatusQueryKey, professionalApplicationQueryKey } from '@/lib/query-keys';

export { professionalApplicationQueryKey };

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
  const { data: broadcastStatus } = useProfessionalApplicationBroadcastStatus(applicationId);

  return useQuery({
    queryKey: [...professionalApplicationQueryKey, applicationId],
    queryFn: () => getProfessionalApplication(applicationId!),
    // The backend deletes the application record once it's denied, so the GET below is doomed to
    // 404 forever after that — skip it entirely instead of hitting (and logging) a guaranteed
    // failure. The status screen falls back to the broadcast status in that case (see [id].tsx).
    enabled: !!applicationId && broadcastStatus !== 'denied',
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
