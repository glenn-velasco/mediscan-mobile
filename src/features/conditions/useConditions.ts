import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/useAuth';
import * as conditionsRepo from '@/db/repositories/conditions.repo';
import { conditionsQueryKey } from '@/lib/query-keys';

export { conditionsQueryKey };

export function useConditions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...conditionsQueryKey, user?.id],
    queryFn: () => conditionsRepo.getAll(),
    enabled: !!user,
  });
}
