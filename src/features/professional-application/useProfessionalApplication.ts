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
  });
}

export function useProfessionalApplicationBroadcastStatus(applicationId: string | number | undefined) {
  return useQuery<ProfessionalApplicationStatus | undefined>({
    queryKey: [...professionalApplicationBroadcastStatusQueryKey, applicationId],
    queryFn: () => undefined,
    enabled: false,
    staleTime: Infinity,
  });
}

export function useProfessionalApplication(applicationId: string | number | undefined) {
  return useQuery({
    queryKey: [...professionalApplicationQueryKey, applicationId],
    queryFn: () => getProfessionalApplication(applicationId!),
    enabled: !!applicationId,
  });
}
