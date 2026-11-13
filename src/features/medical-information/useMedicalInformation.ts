import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/useAuth';
import { getMedicalInformationStorageState } from '@/api/endpoints/medical-information';
import * as medicalInformationRepo from '@/db/repositories/medical-information.repo';
import { medicalInformationQueryKey } from '@/lib/query-keys';

export { medicalInformationQueryKey };

export function useMedicalInformation() {
  const { user } = useAuth();
  const local = useQuery({
    queryKey: [...medicalInformationQueryKey, user?.id],
    queryFn: () => medicalInformationRepo.getLocal(),
    enabled: !!user,
  });
  const storageState = useQuery({
    queryKey: [...medicalInformationQueryKey, 'cloud-state', user?.id],
    queryFn: getMedicalInformationStorageState,
    enabled: !!user,
  });

  return {
    ...local,
    storageState: storageState.data,
    isStorageStateLoading: storageState.isLoading,
    isStorageStateError: storageState.isError,
  };
}
