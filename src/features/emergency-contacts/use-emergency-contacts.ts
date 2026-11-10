import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/auth/useAuth";
import * as emergencyContactsRepo from "@/db/repositories/emergency-contacts.repo";
import { emergencyContactsQueryKey } from "@/lib/query-keys";

export { emergencyContactsQueryKey };

export function useEmergencyContacts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...emergencyContactsQueryKey, user?.id],
    queryFn: () => emergencyContactsRepo.getAll(),
    enabled: !!user,
  });
}
