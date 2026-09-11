import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/useAuth';
import * as scannedPatientsRepo from '@/db/repositories/scanned-patients.repo';
import { professionalScansQueryKey } from '@/lib/query-keys';

export { professionalScansQueryKey };

export function useScannedPatients() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...professionalScansQueryKey, user?.id],
    queryFn: () => scannedPatientsRepo.getAll(),
    enabled: !!user,
    placeholderData: (previousData) => previousData,
  });
}
