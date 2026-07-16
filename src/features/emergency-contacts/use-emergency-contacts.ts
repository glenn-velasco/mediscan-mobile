import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/auth/useAuth';
import * as emergencyContactsRepo from '@/db/repositories/emergency-contacts.repo';

export const emergencyContactsQueryKey = ['emergencyContacts'] as const;

export function useEmergencyContacts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...emergencyContactsQueryKey, user?.id],
    queryFn: () => emergencyContactsRepo.getAll(),
    enabled: !!user,
  });
}
