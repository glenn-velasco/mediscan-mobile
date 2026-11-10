import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/useAuth';
import * as allergiesRepo from '@/db/repositories/allergies.repo';
import { allergiesQueryKey } from '@/lib/query-keys';

export { allergiesQueryKey };

export function useAllergies() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...allergiesQueryKey, user?.id],
    queryFn: () => allergiesRepo.getAll(),
    enabled: !!user,
  });
}
