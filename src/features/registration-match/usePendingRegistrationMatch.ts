import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/auth/useAuth';
import {
  acceptRegistrationMatch,
  denyRegistrationMatch,
  listPendingRegistrationMatches,
} from '@/api/endpoints/registration-matches';

export const registrationMatchQueryKey = ['registration-match'] as const;

/** Matches awaiting the authenticated user's decision (as a candidate record's primary user). */
export function usePendingRegistrationMatchesToReview() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...registrationMatchQueryKey, 'pending', user?.id],
    queryFn: listPendingRegistrationMatches,
    enabled: !!user,
  });
}

export function useDecideRegistrationMatch(id: number) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: registrationMatchQueryKey });

  const accept = useMutation({ mutationFn: () => acceptRegistrationMatch(id), onSuccess: invalidate });
  const deny = useMutation({ mutationFn: () => denyRegistrationMatch(id), onSuccess: invalidate });

  return { accept, deny };
}
