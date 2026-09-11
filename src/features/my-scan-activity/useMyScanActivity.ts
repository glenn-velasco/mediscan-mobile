import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/useAuth';
import * as myScanActivityRepo from '@/db/repositories/my-scan-activity.repo';
import { myScanActivityQueryKey } from '@/lib/query-keys';

export { myScanActivityQueryKey };

export function useMyScanActivity() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...myScanActivityQueryKey, user?.id],
    queryFn: () => myScanActivityRepo.getAll(),
    enabled: !!user,
    refetchOnMount: 'always',
    placeholderData: (previousData) => previousData,
  });
}
