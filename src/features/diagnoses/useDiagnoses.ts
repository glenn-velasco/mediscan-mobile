import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/useAuth';
import * as diagnosesRepo from '@/db/repositories/diagnoses.repo';

export const diagnosesQueryKey = ['diagnoses'] as const;

export function useDiagnoses() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...diagnosesQueryKey, user?.id],
    queryFn: () => diagnosesRepo.getAll(),
    enabled: !!user,
  });
}
