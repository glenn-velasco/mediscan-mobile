import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as emergencyContactsRepo from '@/db/repositories/emergency-contacts.repo';
import { emergencyContactsQueryKey } from '@/features/emergency-contacts/use-emergency-contacts';
import type { EmergencyContactPayload } from '@/api/types';

export function useCreateEmergencyContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: EmergencyContactPayload) => emergencyContactsRepo.createLocal(payload),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: emergencyContactsQueryKey });
    },
  });
}
