import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/useAuth';
import * as medicationsRepo from '@/db/repositories/medications.repo';
import { medicationsQueryKey } from '@/lib/query-keys';

export { medicationsQueryKey };

export function useMedications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...medicationsQueryKey, user?.id],
    queryFn: () => medicationsRepo.getAll(),
    enabled: !!user,
    placeholderData: (previousData) => previousData,
  });
}
