import { useQuery } from '@tanstack/react-query';

import { getProfessionalApplication } from '@/api/endpoints/professional-applications';
import { professionalApplicationQueryKey } from '@/lib/query-keys';

export { professionalApplicationQueryKey };

/** Polls (and is invalidated by ProfessionalApplicationStatusChanged, see realtime/events/handlers.ts) an application's review status. */
export function useProfessionalApplication(applicationId: number | undefined) {
  return useQuery({
    queryKey: [...professionalApplicationQueryKey, applicationId],
    queryFn: () => getProfessionalApplication(applicationId!),
    enabled: !!applicationId,
    // Backend processing (OCR + liveness + face-match) typically finishes in seconds; poll while
    // it's still in flight so the status screen updates even if the realtime event is missed.
    refetchInterval: (query) => (query.state.data?.status === 'processing' ? 3000 : false),
  });
}
