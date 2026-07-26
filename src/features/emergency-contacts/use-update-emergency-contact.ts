import { useMutation, useQueryClient } from '@tanstack/react-query';

import * as emergencyContactsRepo from '@/db/repositories/emergency-contacts.repo';
import { emergencyContactsQueryKey } from '@/features/emergency-contacts/use-emergency-contacts';
import type { EmergencyContactPayload } from '@/api/types';

export function useUpdateEmergencyContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ localUuid, payload }: { localUuid: string; serverId: number | null; payload: Partial<EmergencyContactPayload> }) =>
      emergencyContactsRepo.updateLocal(localUuid, payload),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: emergencyContactsQueryKey });
    },
  });
}
