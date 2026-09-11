import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/useAuth';
import { getScannedPatientDetail } from '@/api/endpoints/professional-scans';
import { professionalScansQueryKey } from '@/lib/query-keys';

export function useScannedPatientDetail(patientId: string | number | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...professionalScansQueryKey, 'detail', patientId, user?.id],
    queryFn: () => getScannedPatientDetail(patientId!),
    enabled: !!user && patientId !== null,
    placeholderData: (previousData) => previousData,
  });
}
