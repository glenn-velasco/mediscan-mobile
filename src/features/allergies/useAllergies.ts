import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/useAuth';
import * as allergiesRepo from '@/db/repositories/allergies.repo';

export const allergiesQueryKey = ['allergies'] as const;

export function useAllergies() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...allergiesQueryKey, user?.id],
    queryFn: () => allergiesRepo.getAll(),
    enabled: !!user,
  });
}
