import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as emergencyContactsRepo from '@/db/repositories/emergency-contacts.repo';
import { emergencyContactsQueryKey } from '@/features/emergency-contacts/use-emergency-contacts';
import { pushPatientChanges } from '@/services/patient-sync.service';

export function useDeleteEmergencyContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (localUuid: string) => emergencyContactsRepo.deleteLocal(localUuid),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: emergencyContactsQueryKey });
      void pushPatientChanges();
    },
  });
}
