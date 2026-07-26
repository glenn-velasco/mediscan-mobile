import { useQuery } from '@tanstack/react-query';

import { getMyProfessionalApplication, getProfessionalApplication } from '@/api/endpoints/professional-applications';
import type { ProfessionalApplicationStatus } from '@/api/types';
import {
  myProfessionalApplicationQueryKey,
  professionalApplicationBroadcastStatusQueryKey,
  professionalApplicationQueryKey,
} from '@/lib/query-keys';

export { professionalApplicationQueryKey };

export function useMyProfessionalApplication() {
  return useQuery({
    queryKey: myProfessionalApplicationQueryKey,
    queryFn: getMyProfessionalApplication,
    staleTime: 0,
    refetchInterval: 10_000,
  });
}

export function useProfessionalApplicationBroadcastStatus(applicationId: number | undefined) {
  return useQuery<ProfessionalApplicationStatus | undefined>({
    queryKey: [...professionalApplicationBroadcastStatusQueryKey, applicationId],
    queryFn: () => undefined,
    enabled: false,
    staleTime: Infinity,
  });
}

export function useProfessionalApplication(applicationId: number | undefined) {
  return useQuery({
    queryKey: [...professionalApplicationQueryKey, applicationId],
    queryFn: () => getProfessionalApplication(applicationId!),
    enabled: !!applicationId,
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false;
      return query.state.data?.status === 'processing' ? 3000 : false;
    },
  });
}
