import { useQuery } from '@tanstack/react-query';
import { getProfessionalEncounters } from '@/api/endpoints/professional-scans';
import { useAuth } from '@/auth/useAuth';
import { professionalEncountersQueryKey } from '@/lib/query-keys';

export function useProfessionalEncounters(patientId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...professionalEncountersQueryKey, patientId ?? user?.id],
    queryFn: async () => {
      const encounters = await getProfessionalEncounters(patientId);
      if (__DEV__) console.log('[Encounters] fetched from Supabase', { patientId: patientId ?? user?.id, count: encounters.length, vitalCount: encounters.reduce((count, encounter) => count + encounter.vitals.length, 0) });
      return encounters;
    },
    enabled: Boolean(user),
    staleTime: 30_000,
  });
}
