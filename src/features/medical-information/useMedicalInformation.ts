import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/useAuth';
import * as medicalInformationRepo from '@/db/repositories/medical-information.repo';
import { medicalInformationQueryKey } from '@/lib/query-keys';

export { medicalInformationQueryKey };

export function useMedicalInformation() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...medicalInformationQueryKey, user?.id],
    queryFn: () => medicalInformationRepo.getLocal(),
    enabled: !!user,
  });
}
